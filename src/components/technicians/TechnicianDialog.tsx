import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { geocodeAddress } from "@/lib/geo";
import { Loader2 } from "lucide-react";

export interface TechnicianRecord {
  id: string;
  name: string;
  area: string;
  service: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  technician?: TechnicianRecord | null;
  onSaved?: () => void;
}

export function TechnicianDialog({ open, onOpenChange, technician, onSaved }: Props) {
  const [name, setName] = useState("");
  const [area, setArea] = useState("");
  const [service, setService] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setName(technician?.name ?? "");
      setArea(technician?.area ?? "");
      setService(technician?.service ?? "");
      setNotes(technician?.notes ?? "");
    }
  }, [open, technician]);

  const handleSubmit = async () => {
    const cleanName = name.trim();
    const cleanArea = area.trim();
    if (!cleanName || !cleanArea) {
      toast({ title: "Missing info", description: "Name and Area are required.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      // Geocode area (best-effort; skip if unchanged)
      let latitude = technician?.latitude ?? null;
      let longitude = technician?.longitude ?? null;
      const areaChanged = !technician || technician.area !== cleanArea;
      if (areaChanged) {
        const coords = await geocodeAddress(cleanArea);
        if (coords) {
          latitude = coords.latitude;
          longitude = coords.longitude;
        } else {
          latitude = null;
          longitude = null;
        }
      }

      const payload = {
        name: cleanName,
        area: cleanArea,
        service: service.trim() || null,
        notes: notes.trim() || null,
        latitude,
        longitude,
      };

      let error;
      if (technician) {
        ({ error } = await supabase.from("technicians").update(payload).eq("id", technician.id));
      } else {
        const { data: { user } } = await supabase.auth.getUser();
        ({ error } = await supabase.from("technicians").insert({ ...payload, created_by: user?.id ?? null }));
      }

      if (error) {
        toast({ title: "Save failed", description: error.message, variant: "destructive" });
      } else {
        toast({
          title: technician ? "Technician updated" : "Technician added",
          description: latitude === null ? "Location could not be mapped — marker will not appear until Area is fixed." : undefined,
        });
        onSaved?.();
        onOpenChange(false);
      }
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{technician ? "Edit Technician" : "Add Technician"}</DialogTitle>
          <DialogDescription>Manage a technician for the Map View.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="tech-name">Technician Name *</Label>
            <Input id="tech-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. John Smith" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tech-area">Area *</Label>
            <Input id="tech-area" value={area} onChange={(e) => setArea(e.target.value)} placeholder="e.g. Miami, FL or 33101" />
            <p className="text-[11px] text-muted-foreground">City & state, ZIP code, or full address. Used to place the marker.</p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tech-service">Service</Label>
            <Input id="tech-service" value={service} onChange={(e) => setService(e.target.value)} placeholder="e.g. Plumbing" />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="tech-notes">Notes</Label>
            <Textarea id="tech-notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>Cancel</Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {technician ? "Save Changes" : "Add Technician"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
