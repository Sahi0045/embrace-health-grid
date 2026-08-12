# PowerShell Script to Verify Bed & Room Management Implementation
Write-Host ""
Write-Host "=== Bed & Room Management - Pre-Test Verification ===" -ForegroundColor Cyan
Write-Host ""

# Check if migration file exists
Write-Host "Checking database migration..." -ForegroundColor Yellow
$migrationFile = "supabase\migrations\20260807000000_hospital_infrastructure_hierarchy.sql"
if (Test-Path $migrationFile) {
    Write-Host "  [OK] Migration file found" -ForegroundColor Green
} else {
    Write-Host "  [ERROR] Migration file missing" -ForegroundColor Red
}

# Check operations.server.ts
Write-Host ""
Write-Host "Checking server functions..." -ForegroundColor Yellow
$opsFile = "src\lib\operations.server.ts"
if (Test-Path $opsFile) {
    $opsContent = Get-Content $opsFile -Raw
    $functions = @("getBedRoomStatistics", "getBeds", "getHospitalInfrastructure", "createBuilding", "updateBedStatus")
    foreach ($func in $functions) {
        if ($opsContent -match $func) {
            Write-Host "  [OK] Function exists: $func" -ForegroundColor Green
        } else {
            Write-Host "  [MISSING] Function: $func" -ForegroundColor Red
        }
    }
} else {
    Write-Host "  [ERROR] operations.server.ts not found" -ForegroundColor Red
}

# Check Admin Portal files
Write-Host ""
Write-Host "Checking Admin Portal files..." -ForegroundColor Yellow
$adminFiles = @("admin-portal\src\routes\beds-rooms.tsx", "admin-portal\src\lib\admin-api.ts")
foreach ($file in $adminFiles) {
    if (Test-Path $file) {
        Write-Host "  [OK] $file" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] $file" -ForegroundColor Red
    }
}

# Check Staff Portal
Write-Host ""
Write-Host "Checking Staff Portal integration..." -ForegroundColor Yellow
$staffFile = "src\routes\staff.rooms.tsx"
if (Test-Path $staffFile) {
    $staffContent = Get-Content $staffFile -Raw
    if (($staffContent -match "getBedRoomStatistics") -and ($staffContent -match "useTableRefresh")) {
        Write-Host "  [OK] Staff Portal has bed status integration" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] Staff Portal bed status features" -ForegroundColor Red
    }
} else {
    Write-Host "  [ERROR] staff.rooms.tsx not found" -ForegroundColor Red
}

# Check Patient Portal
Write-Host ""
Write-Host "Checking Patient Portal integration..." -ForegroundColor Yellow
$patientFile = "src\routes\patient.inpatient.tsx"
if (Test-Path $patientFile) {
    $patientContent = Get-Content $patientFile -Raw
    if (($patientContent -match "getBedRoomStatistics") -and ($patientContent -match "useTableRefresh")) {
        Write-Host "  [OK] Patient Portal has bed availability display" -ForegroundColor Green
    } else {
        Write-Host "  [MISSING] Patient Portal bed availability features" -ForegroundColor Red
    }
} else {
    Write-Host "  [ERROR] patient.inpatient.tsx not found" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "=== Verification Complete ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Apply database migration: supabase db push" -ForegroundColor White
Write-Host "2. Start main app: npm run dev" -ForegroundColor White
Write-Host "3. Start admin portal: cd admin-portal; npm run dev" -ForegroundColor White
Write-Host "4. Follow TESTING-BED-ROOM-MANAGEMENT.md" -ForegroundColor White
Write-Host ""
