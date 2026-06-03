import { createFileRoute } from "@tanstack/react-router";
import { RouteGuard } from "@/components/RouteGuard";
import { PageHeader, StatCard } from "@/components/PageHeader";
import { BedStatusCard } from "@/components/infrastructure/BedStatusCard";
import { EquipmentCard } from "@/components/infrastructure/EquipmentCard";
import { AmbulanceCard } from "@/components/infrastructure/AmbulanceCard";
import { FacilityMap } from "@/components/infrastructure/FacilityMap";
import { mockBeds, mockEquipment, mockAmbulances, infraStats } from "@/lib/mock-infrastructure";
import { Bed, Wrench, Ambulance, Search, Wind, Map } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/admin/resources")({
  head: () => ({ meta: [{ title: "Resources — Admin Console" }] }),
  component: ResourcesPage,
});

type Tab = "beds" | "equipment" | "ambulances" | "map";

const facilityZones = [
  { id: "z1",  label: "Emergency Dept.",     type: "emergency" as const,  floor: 0, building: "Emergency Block",  occupancy: 6,  capacity: 8,  status: "busy" as const },
  { id: "z2",  label: "Pharmacy",            type: "pharmacy" as const,   floor: 0, building: "Main Block",       status: "active" as const },
  { id: "z3",  label: "General Ward 2C",     type: "ward" as const,       floor: 2, building: "Main Block",       occupancy: 18, capacity: 24, status: "active" as const },
  { id: "z4",  label: "Orthopedics 3D",      type: "ward" as const,       floor: 3, building: "Main Block",       occupancy: 14, capacity: 20, status: "active" as const },
  { id: "z5",  label: "Cardiology Ward 4A",  type: "ward" as const,       floor: 4, building: "Main Block",       occupancy: 16, capacity: 20, status: "busy" as const },
  { id: "z6",  label: "ICU Block B",         type: "icu" as const,        floor: 3, building: "Critical Block",   occupancy: 14, capacity: 16, status: "busy" as const },
  { id: "z7",  label: "Operating Room 1-4",  type: "surgery" as const,    floor: 2, building: "Surgical Block",   occupancy: 3,  capacity: 4,  status: "busy" as const },
  { id: "z8",  label: "Post-Op Recovery",    type: "ward" as const,       floor: 2, building: "Surgical Block",   occupancy: 5,  capacity: 10, status: "active" as const },
  { id: "z9",  label: "Radiology (MRI/CT)",  type: "radiology" as const,  floor: 1, building: "Tower B",          occupancy: 2,  capacity: 3,  status: "active" as const },
  { id: "z10", label: "Neurology 5A",        type: "ward" as const,       floor: 5, building: "Tower B",          occupancy: 11, capacity: 15, status: "active" as const },
  { id: "z11", label: "Oncology 6C",         type: "ward" as const,       floor: 6, building: "Tower B",          occupancy: 9,  capacity: 12, status: "active" as const },
  { id: "z12", label: "Pediatrics 1B",       type: "ward" as const,       floor: 1, building: "Children's Wing",  occupancy: 7,  capacity: 14, status: "active" as const },
  { id: "z13", label: "Neonatal ICU",        type: "icu" as const,        floor: 1, building: "Children's Wing",  occupancy: 4,  capacity: 6,  status: "busy" as const },
  { id: "z14", label: "Maternity Ward",      type: "ward" as const,       floor: 3, building: "Women's Block",    occupancy: 8,  capacity: 12, status: "active" as const },
  { id: "z15", label: "Admin Block",         type: "admin" as const,      floor: 1, building: "Admin Wing",       status: "active" as const },
];

function ResourcesPage() {
  const [tab, setTab] = useState<Tab>("beds");
  const [search, setSearch] = useState("");
  const [equipFilter, setEquipFilter] = useState("all");

  const filteredBeds = mockBeds.filter(b =>
    b.bedNo.toLowerCase().includes(search.toLowerCase()) ||
    b.ward.toLowerCase().includes(search.toLowerCase()) ||
    (b.patientName ?? "").toLowerCase().includes(search.toLowerCase())
  );

  const filteredEquipment = mockEquipment.filter(e =>
    (equipFilter === "all" || e.type === equipFilter) &&
    (e.name.toLowerCase().includes(search.toLowerCase()) ||
     e.department.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <RouteGuard requiredRole="admin">
      <PageHeader
        eyebrow="Admin Console"
        title="Resource Tracking"
        description="Real-time tracking of beds, medical equipment, ambulance fleet, and facility layout"
      />

      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 px-6 pt-6">
        <StatCard
          label="Total Beds" value={infraStats.totalBeds} icon={Bed} tone="default"
          delta={`${infraStats.occupiedBeds} occupied · ${infraStats.availableBeds} available`}
        />
        <StatCard
          label="Medical Equipment" value={infraStats.totalEquipment} icon={Wrench} tone="default"
          delta={`${infraStats.operationalEquipment} operational`}
        />
        <StatCard
          label="Ambulances" value={infraStats.totalAmbulances} icon={Ambulance} tone="default"
          delta={`${infraStats.availableAmbulances} available`}
        />
        <StatCard
          label="Ventilators" value={infraStats.ventilators} icon={Wind} tone="success"
          delta={`${infraStats.mriScanners} MRI · ${infraStats.ctScanners} CT`}
        />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-border px-6 mt-6 bg-card">
        {([
          { key: "beds",       label: "Beds (250)",       icon: Bed },
          { key: "equipment",  label: "Equipment (100)",  icon: Wrench },
          { key: "ambulances", label: "Ambulances (20)",  icon: Ambulance },
          { key: "map",        label: "Facility Map",     icon: Map },
        ] as const).map(t => (
          <button
            key={t.key}
            onClick={() => { setTab(t.key); setSearch(""); }}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="h-3.5 w-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-4">
        {/* Search & filter bar — shown for beds/equipment/ambulances */}
        {tab !== "map" && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 shadow-clinical flex-1 min-w-48">
              <Search className="h-4 w-4 text-muted-foreground shrink-0" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder={`Search ${tab}…`}
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {tab === "equipment" && (
              <select
                value={equipFilter}
                onChange={e => setEquipFilter(e.target.value)}
                className="rounded-lg border border-border bg-card px-3 py-2 text-sm text-foreground shadow-clinical outline-none"
              >
                <option value="all">All Types</option>
                <option value="mri">MRI</option>
                <option value="ct">CT Scanner</option>
                <option value="xray">X-Ray</option>
                <option value="ventilator">Ventilator</option>
                <option value="wheelchair">Wheelchair</option>
                <option value="oxygen-cylinder">Oxygen Cylinder</option>
                <option value="dialysis">Dialysis</option>
                <option value="defibrillator">Defibrillator</option>
                <option value="infusion">Infusion Pump</option>
              </select>
            )}
          </div>
        )}

        {/* Beds grid */}
        {tab === "beds" && (
          <>
            <div className="text-xs text-muted-foreground">
              Showing {Math.min(filteredBeds.length, 60)} of {filteredBeds.length} beds
            </div>
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {filteredBeds.slice(0, 60).map(b => (
                <BedStatusCard key={b.id} bed={b} />
              ))}
            </div>
          </>
        )}

        {/* Equipment grid */}
        {tab === "equipment" && (
          <>
            <div className="text-xs text-muted-foreground">
              Showing {filteredEquipment.length} of {mockEquipment.length} items
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredEquipment.map(e => (
                <EquipmentCard key={e.id} equipment={e} />
              ))}
            </div>
          </>
        )}

        {/* Ambulances grid */}
        {tab === "ambulances" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {mockAmbulances.map(a => (
              <AmbulanceCard key={a.id} ambulance={a} />
            ))}
          </div>
        )}

        {/* Facility Map */}
        {tab === "map" && (
          <FacilityMap
            buildingName="Apollo Hospitals, Mumbai — All Buildings"
            zones={facilityZones}
          />
        )}
      </div>
    </RouteGuard>
  );
}
