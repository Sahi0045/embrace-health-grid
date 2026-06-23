import { createFileRoute } from "@tanstack/react-router";
import { PageHeader } from "@/components/PageHeader";
import { RouteGuard } from "@/components/RouteGuard";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Building2, Bed, Activity, Stethoscope, Ambulance, HeartPulse,
  Microscope, Pill, Droplets, Gauge, AlertTriangle, CheckCircle,
  TrendingUp, MapPin, Calendar, Users, Wrench, Phone
} from "lucide-react";
import {
  departments, wards, medicalEquipment, operatingTheaters,
  diagnosticFacilities, buildings, ambulanceFleet, pharmacies,
  bloodBank, infrastructureStats
} from "@/lib/infrastructure-data";

export const Route = createFileRoute("/infrastructure")({
  head: () => ({
    meta: [
      { title: "Hospital Infrastructure — Admin Console" },
      { name: "description", content: "Manage hospital buildings, departments, and resources" },
    ],
  }),
  component: HospitalInfrastructure,
});

function HospitalInfrastructure() {
  const getStatusColor = (status: string) => {
    switch (status) {
      case "operational":
      case "available":
      case "adequate":
        return "bg-success/10 text-success";
      case "in-use":
      case "on-duty":
        return "bg-primary/10 text-primary";
      case "maintenance":
      case "low":
        return "bg-warning/10 text-warning-foreground";
      case "offline":
      case "critical":
      case "out-of-service":
        return "bg-destructive/10 text-destructive";
      default:
        return "bg-muted text-muted-foreground";
    }
  };

  return (
    <RouteGuard requiredRole="admin">
      <>
        <PageHeader
          eyebrow="Admin console"
          title="Hospital Infrastructure"
          description="Complete overview and management of hospital facilities, resources, and operations"
        />

        <div className="space-y-6 p-8">
          {/* Overview Stats */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Buildings</div>
                    <div className="text-2xl font-semibold">{infrastructureStats.totalBuildings}</div>
                    <div className="text-xs text-muted-foreground">{infrastructureStats.totalFloors} floors total</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10">
                    <Bed className="h-5 w-5 text-success" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Bed Occupancy</div>
                    <div className="text-2xl font-semibold">{infrastructureStats.occupancyRate}%</div>
                    <div className="text-xs text-muted-foreground">
                      {infrastructureStats.occupiedBeds}/{infrastructureStats.totalBeds} beds
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-2/10">
                    <Stethoscope className="h-5 w-5 text-chart-2" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Departments</div>
                    <div className="text-2xl font-semibold">{infrastructureStats.totalDepartments}</div>
                    <div className="text-xs text-muted-foreground">All operational</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-chart-4/10">
                    <Users className="h-5 w-5 text-chart-4" />
                  </div>
                  <div>
                    <div className="text-sm text-muted-foreground">Staff On Duty</div>
                    <div className="text-2xl font-semibold">{infrastructureStats.onDutyStaff}</div>
                    <div className="text-xs text-muted-foreground">
                      of {infrastructureStats.totalStaff} total
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Tabs */}
          <Tabs defaultValue="buildings" className="w-full">
            <TabsList>
              <TabsTrigger value="buildings">Buildings</TabsTrigger>
              <TabsTrigger value="departments">Departments</TabsTrigger>
              <TabsTrigger value="equipment">Equipment</TabsTrigger>
              <TabsTrigger value="facilities">Facilities</TabsTrigger>
              <TabsTrigger value="resources">Resources</TabsTrigger>
            </TabsList>

            {/* Buildings Tab */}
            <TabsContent value="buildings" className="space-y-4 mt-4">
              <div className="grid gap-4 lg:grid-cols-2">
                {buildings.map((building) => (
                  <Card key={building.id}>
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle>{building.name}</CardTitle>
                          <CardDescription className="mt-1">
                            <MapPin className="mr-1 inline h-3 w-3" />
                            {building.address}
                          </CardDescription>
                        </div>
                        {building.helipadAvailable && (
                          <Badge variant="outline">
                            <Activity className="mr-1 h-3 w-3" />
                            Helipad
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Floors</div>
                          <div className="font-medium">{building.totalFloors}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Area</div>
                          <div className="font-medium">{building.totalArea.toLocaleString()} m²</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Total Beds</div>
                          <div className="font-medium">{building.totalBeds}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Occupied</div>
                          <div className="font-medium">{building.occupiedBeds}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Parking</div>
                          <div className="font-medium">{building.parkingSpaces} spaces</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Year Built</div>
                          <div className="font-medium">{building.yearBuilt}</div>
                        </div>
                      </div>
                      <div>
                        <div className="mb-2 text-sm font-medium">Departments</div>
                        <div className="flex flex-wrap gap-1">
                          {building.departments.map((dept, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {dept}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full bg-primary"
                          style={{ width: `${(building.occupiedBeds / building.totalBeds) * 100}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round((building.occupiedBeds / building.totalBeds) * 100)}% bed occupancy
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </TabsContent>

            {/* Departments Tab */}
            <TabsContent value="departments" className="space-y-4 mt-4">
              {departments.map((dept) => (
                <Card key={dept.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{dept.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {dept.building} • Floor {dept.floor} • Ext: {dept.contactExtension}
                        </CardDescription>
                      </div>
                      {dept.emergencyCapable && (
                        <Badge variant="destructive">
                          <AlertTriangle className="mr-1 h-3 w-3" />
                          Emergency
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Head of Department</div>
                        <div className="font-medium">{dept.headOfDepartment}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Operating Hours</div>
                        <div className="font-medium">{dept.operatingHours}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Beds</div>
                        <div className="font-medium">{dept.occupiedBeds}/{dept.totalBeds}</div>
                        <div className="text-xs text-muted-foreground">
                          {Math.round((dept.occupiedBeds / dept.totalBeds) * 100)}% occupied
                        </div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Staff</div>
                        <div className="font-medium">{dept.onDutyStaff}/{dept.totalStaff}</div>
                        <div className="text-xs text-muted-foreground">On duty</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="mb-2 text-sm font-medium">Specialties</div>
                      <div className="flex flex-wrap gap-1">
                        {dept.specialties.map((spec, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            {spec}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Equipment Tab */}
            <TabsContent value="equipment" className="space-y-4 mt-4">
              <div className="mb-4 grid gap-4 sm:grid-cols-3">
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Total Equipment</div>
                    <div className="text-2xl font-semibold">{infrastructureStats.totalEquipment}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Currently In Use</div>
                    <div className="text-2xl font-semibold">{infrastructureStats.equipmentInUse}</div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="p-4">
                    <div className="text-sm text-muted-foreground">Utilization Rate</div>
                    <div className="text-2xl font-semibold">
                      {Math.round((infrastructureStats.equipmentInUse / infrastructureStats.totalEquipment) * 100)}%
                    </div>
                  </CardContent>
                </Card>
              </div>

              {medicalEquipment.map((equipment) => (
                <Card key={equipment.id}>
                  <CardHeader>
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{equipment.name}</CardTitle>
                        <CardDescription className="mt-1">
                          {equipment.model} • {equipment.manufacturer}
                        </CardDescription>
                      </div>
                      <Badge className={getStatusColor(equipment.status)}>
                        {equipment.status}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-3 text-sm sm:grid-cols-4">
                      <div>
                        <div className="text-muted-foreground">Location</div>
                        <div className="font-medium">{equipment.location}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Department</div>
                        <div className="font-medium">{equipment.department}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Serial Number</div>
                        <div className="font-mono text-xs">{equipment.serialNumber}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Utilization</div>
                        <div className="font-medium">{equipment.utilizationRate}%</div>
                      </div>
                    </div>
                    <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                      <div>
                        <div className="text-muted-foreground">Last Maintenance</div>
                        <div>{new Date(equipment.lastMaintenance).toLocaleDateString()}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Next Maintenance</div>
                        <div>{new Date(equipment.nextMaintenance).toLocaleDateString()}</div>
                      </div>
                      {equipment.warrantyExpiry && (
                        <div>
                          <div className="text-muted-foreground">Warranty Until</div>
                          <div>{new Date(equipment.warrantyExpiry).toLocaleDateString()}</div>
                        </div>
                      )}
                    </div>
                    {equipment.assignedTo && (
                      <div className="mt-2 text-xs">
                        <span className="text-muted-foreground">Assigned to:</span> {equipment.assignedTo}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* Facilities Tab */}
            <TabsContent value="facilities" className="space-y-6 mt-4">
              {/* Operating Theaters */}
              <Card>
                <CardHeader>
                  <CardTitle>Operating Theaters</CardTitle>
                  <CardDescription>
                    {infrastructureStats.operationalOTs}/{infrastructureStats.totalOperatingTheaters} operational
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  {operatingTheaters.map((ot) => (
                    <div key={ot.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{ot.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {ot.building} • Floor {ot.floor}
                          </div>
                        </div>
                        <Badge className={getStatusColor(ot.status)}>{ot.status}</Badge>
                      </div>
                      {ot.currentProcedure && (
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">Current:</span> {ot.currentProcedure}
                        </div>
                      )}
                      {ot.todaySchedule.length > 0 && (
                        <div className="mt-2">
                          <div className="mb-1 text-xs font-medium">Today's Schedule</div>
                          {ot.todaySchedule.map((sched, idx) => (
                            <div key={idx} className="text-xs text-muted-foreground">
                              {sched.time} - {sched.procedure} ({sched.surgeon})
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Diagnostic Facilities */}
              <Card>
                <CardHeader>
                  <CardTitle>Diagnostic Facilities</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {diagnosticFacilities.map((facility) => (
                    <div key={facility.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{facility.name}</div>
                          <div className="text-sm text-muted-foreground">
                            {facility.building} • Floor {facility.floor}
                          </div>
                        </div>
                        <Badge className={getStatusColor(facility.status)}>{facility.status}</Badge>
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-sm">
                        <div>
                          <div className="text-muted-foreground text-xs">Today's Tests</div>
                          <div className="font-medium">{facility.todayCount}/{facility.dailyCapacity}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Avg Wait Time</div>
                          <div className="font-medium">{facility.averageWaitTime} min</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground text-xs">Hours</div>
                          <div className="font-medium text-xs">{facility.operatingHours}</div>
                        </div>
                      </div>
                      <div className="mt-2">
                        <div className="mb-1 text-xs font-medium">Equipment</div>
                        <div className="flex flex-wrap gap-1">
                          {facility.equipment.map((eq, idx) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {eq}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Resources Tab */}
            <TabsContent value="resources" className="space-y-6 mt-4">
              {/* Ambulance Fleet */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Ambulance Fleet</CardTitle>
                      <CardDescription>
                        {infrastructureStats.availableAmbulances}/{infrastructureStats.totalAmbulances} available
                      </CardDescription>
                    </div>
                    <Ambulance className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {ambulanceFleet.map((amb) => (
                    <div key={amb.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{amb.vehicleNumber}</div>
                          <div className="text-sm capitalize text-muted-foreground">{amb.type.replace('-', ' ')}</div>
                        </div>
                        <Badge className={getStatusColor(amb.status)}>{amb.status}</Badge>
                      </div>
                      {amb.currentLocation && (
                        <div className="mt-2 text-sm">
                          <MapPin className="mr-1 inline h-3 w-3" />
                          {amb.currentLocation}
                        </div>
                      )}
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">Last Service:</span>{' '}
                          {new Date(amb.lastMaintenance).toLocaleDateString()}
                        </div>
                        <div>
                          <span className="text-muted-foreground">Next Service:</span>{' '}
                          {new Date(amb.nextMaintenance).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Pharmacies */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Pharmacies</CardTitle>
                    <Pill className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  {pharmacies.map((pharm) => (
                    <div key={pharm.id} className="rounded-lg border p-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="font-medium">{pharm.name}</div>
                          <div className="text-sm text-muted-foreground">{pharm.location}</div>
                        </div>
                        <Badge variant="outline">{pharm.operatingHours}</Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <div className="text-muted-foreground">Total Medicines</div>
                          <div className="font-medium">{pharm.totalMedicines}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Today's Prescriptions</div>
                          <div className="font-medium">{pharm.prescriptionsToday}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Low Stock Items</div>
                          <div className="font-medium text-warning">{pharm.lowStockItems}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Expiring Soon</div>
                          <div className="font-medium text-destructive">{pharm.expiringWithin30Days}</div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Blood Bank */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle>Blood Bank</CardTitle>
                    <Droplets className="h-5 w-5 text-muted-foreground" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-2 sm:grid-cols-4">
                    {bloodBank.map((blood) => (
                      <div key={blood.bloodType} className="rounded-lg border p-3">
                        <div className="flex items-center justify-between">
                          <div className="text-lg font-semibold">{blood.bloodType}</div>
                          <Badge className={getStatusColor(blood.status)} variant="outline">
                            {blood.status}
                          </Badge>
                        </div>
                        <div className="mt-2 text-sm">
                          <div className="font-medium">{blood.unitsAvailable} units</div>
                          <div className="text-xs text-muted-foreground">
                            Min: {blood.unitsMinimum} units
                          </div>
                          {blood.expiringWithin7Days > 0 && (
                            <div className="text-xs text-warning">
                              {blood.expiringWithin7Days} expiring soon
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </>
    </RouteGuard>
  );
}
