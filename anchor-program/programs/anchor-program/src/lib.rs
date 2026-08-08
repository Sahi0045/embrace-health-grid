use anchor_lang::prelude::*;

declare_id!("FuL2Ko8zMdej7QU8VtxoyTdmpuF1MsWLECCTVTztQ2iR");

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

        msg!(
            "Registered Merkle Root for patient: {}",
            root_account.patient_did
        );
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

        msg!(
            "Updated Merkle Root for patient: {}",
            root_account.patient_did
        );
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

        msg!(
            "Granted consent for doctor {} to access {}",
            doctor,
            record.resource
        );
        Ok(())
    }

    pub fn revoke_consent(
        _ctx: Context<RevokeConsent>,
        _patient_did: String,
        _doctor: Pubkey,
    ) -> Result<()> {
        msg!("Revoked consent and closed account. Rent reclaimed by patient.");
        Ok(())
    }

    pub fn register_doctor_location(
        ctx: Context<RegisterDoctorLocation>,
        doctor_did: String,
        initial_root: [u8; 32],
    ) -> Result<()> {
        let location_account = &mut ctx.accounts.doctor_location;
        location_account.doctor_did = doctor_did;
        location_account.location_merkle_root = initial_root;
        location_account.last_updated = Clock::get()?.unix_timestamp;
        location_account.authority = ctx.accounts.authority.key();
        location_account.bump = ctx.bumps.doctor_location;

        msg!(
            "Registered Location Merkle Root for doctor: {}",
            location_account.doctor_did
        );
        Ok(())
    }

    pub fn update_doctor_location(
        ctx: Context<UpdateDoctorLocation>,
        _doctor_did: String,
        new_root: [u8; 32],
    ) -> Result<()> {
        let location_account = &mut ctx.accounts.doctor_location;
        location_account.location_merkle_root = new_root;
        location_account.last_updated = Clock::get()?.unix_timestamp;
        location_account.authority = ctx.accounts.authority.key();

        msg!(
            "Updated Location Merkle Root for doctor: {}",
            location_account.doctor_did
        );
        Ok(())
    }

    /// Register a hospital on chain.
    ///
    /// NOTE: the PDA is seeded on `hospital_did`, and a Solana seed is capped at
    /// 32 bytes. With the "did:hosp:org:" prefix that leaves 19 bytes for the
    /// slug, which the caller enforces — a longer DID fails with
    /// "Max seed length exceeded".
    ///
    /// The platform (super admin) is the only signer, so the chain records which
    /// authority admitted each hospital to the consortium. A hospital DID that is
    /// not here was never issued by the platform, which is what makes the
    /// registry verifiable independently of Postgres.
    pub fn register_hospital(
        ctx: Context<RegisterHospital>,
        hospital_did: String,
        name_hash: [u8; 32],
        credential_hash: [u8; 32],
    ) -> Result<()> {
        let hospital = &mut ctx.accounts.hospital;
        hospital.hospital_did = hospital_did;
        hospital.name_hash = name_hash;
        hospital.credential_hash = credential_hash;
        hospital.registered_at = Clock::get()?.unix_timestamp;
        hospital.last_updated = hospital.registered_at;
        hospital.platform_authority = ctx.accounts.platform_authority.key();
        hospital.active = true;
        hospital.staff_count = 0;
        hospital.bump = ctx.bumps.hospital;

        msg!("Registered hospital: {}", hospital.hospital_did);
        Ok(())
    }

    /// Suspend or reinstate a hospital.
    ///
    /// Suspension is recorded rather than deleted: an auditor needs to see that a
    /// hospital was admitted and later suspended, not find an absence.
    pub fn set_hospital_status(
        ctx: Context<SetHospitalStatus>,
        _hospital_did: String,
        active: bool,
    ) -> Result<()> {
        let hospital = &mut ctx.accounts.hospital;
        hospital.active = active;
        hospital.last_updated = Clock::get()?.unix_timestamp;

        msg!(
            "Hospital {} active = {}",
            hospital.hospital_did,
            hospital.active
        );
        Ok(())
    }

    /// Anchor a hospital's staff roster.
    ///
    /// Stores a merkle root over the hospital's issued clinician DIDs, so the
    /// hospital can prove which staff it had vouched for at a point in time
    /// without publishing the roster itself.
    pub fn update_hospital_roster(
        ctx: Context<UpdateHospitalRoster>,
        _hospital_did: String,
        roster_root: [u8; 32],
        staff_count: u32,
    ) -> Result<()> {
        let hospital = &mut ctx.accounts.hospital;
        hospital.roster_root = roster_root;
        hospital.staff_count = staff_count;
        hospital.last_updated = Clock::get()?.unix_timestamp;

        msg!(
            "Hospital {} roster updated, {} staff",
            hospital.hospital_did,
            staff_count
        );
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

#[derive(Accounts)]
#[instruction(doctor_did: String, initial_root: [u8; 32])]
pub struct RegisterDoctorLocation<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + 68 + 32 + 8 + 32 + 1,
        seeds = [b"doctor-location", doctor_did.as_bytes()],
        bump
    )]
    pub doctor_location: Account<'info, DoctorLocationRoot>,

    #[account(mut)]
    pub authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(doctor_did: String, new_root: [u8; 32])]
pub struct UpdateDoctorLocation<'info> {
    #[account(
        mut,
        seeds = [b"doctor-location", doctor_did.as_bytes()],
        bump = doctor_location.bump,
        constraint = doctor_location.authority == authority.key()
    )]
    pub doctor_location: Account<'info, DoctorLocationRoot>,

    pub authority: Signer<'info>,
}

#[account]
pub struct DoctorLocationRoot {
    pub doctor_did: String,
    pub location_merkle_root: [u8; 32],
    pub last_updated: i64,
    pub authority: Pubkey,
    pub bump: u8,
}

#[derive(Accounts)]
#[instruction(hospital_did: String, name_hash: [u8; 32], credential_hash: [u8; 32])]
pub struct RegisterHospital<'info> {
    #[account(
        init,
        payer = platform_authority,
        // 8 discriminator + 4+96 did + 32 name + 32 credential + 32 roster
        // + 8 registered + 8 updated + 32 authority + 1 active + 4 staff + 1 bump
        space = 8 + 100 + 32 + 32 + 32 + 8 + 8 + 32 + 1 + 4 + 1,
        seeds = [b"hospital", hospital_did.as_bytes()],
        bump
    )]
    pub hospital: Account<'info, HospitalRegistration>,

    #[account(mut)]
    pub platform_authority: Signer<'info>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(hospital_did: String, active: bool)]
pub struct SetHospitalStatus<'info> {
    #[account(
        mut,
        seeds = [b"hospital", hospital_did.as_bytes()],
        bump = hospital.bump,
        // Only the authority that admitted the hospital may change its status.
        constraint = hospital.platform_authority == platform_authority.key()
    )]
    pub hospital: Account<'info, HospitalRegistration>,

    pub platform_authority: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(hospital_did: String, roster_root: [u8; 32], staff_count: u32)]
pub struct UpdateHospitalRoster<'info> {
    #[account(
        mut,
        seeds = [b"hospital", hospital_did.as_bytes()],
        bump = hospital.bump,
        constraint = hospital.platform_authority == platform_authority.key()
    )]
    pub hospital: Account<'info, HospitalRegistration>,

    pub platform_authority: Signer<'info>,
}

/// On-chain record that the platform admitted a hospital to the consortium.
///
/// Only hashes are stored: the chain proves a hospital was registered and that
/// its credential has not changed, without publishing hospital details or the
/// roster itself.
#[account]
pub struct HospitalRegistration {
    pub hospital_did: String,
    pub name_hash: [u8; 32],
    pub credential_hash: [u8; 32],
    pub roster_root: [u8; 32],
    pub registered_at: i64,
    pub last_updated: i64,
    pub platform_authority: Pubkey,
    pub active: bool,
    pub staff_count: u32,
    pub bump: u8,
}
