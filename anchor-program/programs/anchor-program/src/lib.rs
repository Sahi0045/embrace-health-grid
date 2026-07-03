use anchor_lang::prelude::*;

declare_id!("BxkLrjBYdb3nh2m9GCfpLXBWrAj3s9MqnRbwktLqSfN3");

#[program]
pub mod anchor_program {
    use super::*;

    pub fn register_patient_root(
        ctx: Context<RegisterPatientRoot>,
        patient_did: String,
        initial_root: [u8; 32],
    ) -> Result<()> {
        let root_account = &mut ctx.accounts.patient_root;
        root_account.patient_did = patient_did;
        root_account.merkle_root = initial_root;
        root_account.last_updated = Clock::get()?.unix_timestamp;
        root_account.authority = ctx.accounts.authority.key();
        root_account.bump = ctx.bumps.patient_root;
        
        msg!("Registered Merkle Root for patient: {}", root_account.patient_did);
        Ok(())
    }

    pub fn update_patient_root(
        ctx: Context<UpdatePatientRoot>,
        _patient_did: String,
        new_root: [u8; 32],
    ) -> Result<()> {
        let root_account = &mut ctx.accounts.patient_root;
        root_account.merkle_root = new_root;
        root_account.last_updated = Clock::get()?.unix_timestamp;
        root_account.authority = ctx.accounts.authority.key();

        msg!("Updated Merkle Root for patient: {}", root_account.patient_did);
        Ok(())
    }

    pub fn grant_consent(
        ctx: Context<GrantConsent>,
        patient_did: String,
        doctor: Pubkey,
        resource: String,
        expiry: i64,
    ) -> Result<()> {
        let record = &mut ctx.accounts.consent_record;
        record.patient_did = patient_did;
        record.doctor = doctor;
        record.resource = resource;
        record.expiry = expiry;
        record.granted_at = Clock::get()?.unix_timestamp;
        record.bump = ctx.bumps.consent_record;

        msg!("Granted consent for doctor {} to access {}", doctor, record.resource);
        Ok(())
    }

    pub fn revoke_consent(_ctx: Context<RevokeConsent>, _patient_did: String, _doctor: Pubkey) -> Result<()> {
        msg!("Revoked consent and closed account. Rent reclaimed by patient.");
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(patient_did: String, initial_root: [u8; 32])]
pub struct RegisterPatientRoot<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 68 + 32 + 8 + 32 + 1,
        seeds = [b"patient-root", patient_did.as_bytes()],
        bump
    )]
    pub patient_root: Account<'info, PatientMedicalRoot>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(patient_did: String, new_root: [u8; 32])]
pub struct UpdatePatientRoot<'info> {
    #[account(
        mut,
        seeds = [b"patient-root", patient_did.as_bytes()],
        bump = patient_root.bump,
        constraint = patient_root.authority == authority.key() || authority.key() == patient_root.key()
    )]
    pub patient_root: Account<'info, PatientMedicalRoot>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(patient_did: String, doctor: Pubkey, resource: String, expiry: i64)]
pub struct GrantConsent<'info> {
    #[account(
        init_if_needed,
        payer = patient,
        space = 8 + 68 + 32 + 68 + 8 + 8 + 1,
        seeds = [b"consent", patient_did.as_bytes(), doctor.as_ref()],
        bump
    )]
    pub consent_record: Account<'info, ConsentRecord>,

    #[account(mut)]
    pub patient: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(patient_did: String, doctor: Pubkey)]
pub struct RevokeConsent<'info> {
    #[account(
        mut,
        close = patient,
        seeds = [b"consent", patient_did.as_bytes(), doctor.as_ref()],
        bump = consent_record.bump
    )]
    pub consent_record: Account<'info, ConsentRecord>,

    #[account(mut)]
    pub patient: Signer<'info>,
}

#[account]
pub struct PatientMedicalRoot {
    pub patient_did: String,
    pub merkle_root: [u8; 32],
    pub last_updated: i64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[account]
pub struct ConsentRecord {
    pub patient_did: String,
    pub doctor: Pubkey,
    pub resource: String,
    pub expiry: i64,
    pub granted_at: i64,
    pub bump: u8,
}
