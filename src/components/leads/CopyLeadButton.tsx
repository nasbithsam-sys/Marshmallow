import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Copy, Check } from 'lucide-react';
import { toast } from 'sonner';
import type { Lead } from '@/types';
<<<<<<< HEAD
import { cn } from '@/lib/utils';

interface Props {
  lead: Lead;
  className?: string;
=======

interface Props {
  lead: Lead;
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
}

const formatScheduleDate = (lead: Lead) => {
  if (!lead.scheduled_date) return 'TBD';
  const date = new Date(lead.scheduled_date + 'T12:00:00');
  const days = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  
  const today = new Date();
  const isToday = date.toDateString() === today.toDateString();
  const dayName = days[date.getDay()];
  const day = date.getDate();
  const month = months[date.getMonth()];
  
  const suffix = day === 1 || day === 21 || day === 31 ? 'st' : day === 2 || day === 22 ? 'nd' : day === 3 || day === 23 ? 'rd' : 'th';

  const formatTime = (time: string | null) => {
    if (!time) return '';
    const [h, m] = time.split(':').map(Number);
    const ampm = h >= 12 ? 'pm' : 'am';
    const hour = h % 12 || 12;
    return m === 0 ? `${hour}:00${ampm}` : `${hour}:${m.toString().padStart(2, '0')}${ampm}`;
  };

  const startTime = formatTime(lead.scheduled_time_start);
  const endTime = formatTime(lead.scheduled_time_end);
  const timeRange = startTime && endTime ? ` between ${startTime}-${endTime}` : '';

  return `${isToday ? 'Today ' : ''}${dayName} ${day}${suffix} ${month}${timeRange}`;
};

<<<<<<< HEAD
export default function CopyLeadButton({ lead, className }: Props) {
=======
export default function CopyLeadButton({ lead }: Props) {
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
  const [open, setOpen] = useState(false);
  const [customerNumber, setCustomerNumber] = useState('');
  const [referenceName, setReferenceName] = useState(lead.reference_name || '');
  const [copied, setCopied] = useState(false);

  const isQuoted = lead.terms === 'quoted';
  const isFreeEstimate = lead.terms === 'free_estimate';

  const generateText = () => {
    const schedule = formatScheduleDate(lead);
    const refLine = referenceName ? `\n-\n(Give the reference of "${referenceName}" if customer ask)` : '';

    if (isFreeEstimate) {
      return `*Customer #${customerNumber ? ' ' + customerNumber : ''}*

Customer Name: ${lead.customer_name}
Customer Number: ${lead.customer_phone || ''}
Customer Address: ${lead.address || ''}
Service Details: ${lead.service_details || lead.service_type || ''}

FREE ESTIMATE VISIT

FREE ESTIMATE VISIT Scheduled for: ${schedule}
${refLine}`;
    }

    if (isQuoted) {
      return `*Customer #${customerNumber ? ' ' + customerNumber : ''}*

Customer Name: ${lead.customer_name}
Customer Number: ${lead.customer_phone || ''}
Customer Address: ${lead.address || ''}
Service: ${lead.service_details || lead.service_type || ''}

Customer is agreed to pay ($${lead.labor_amount ?? 0}) total labor
($${lead.material_amount ?? 0}) FOR MATERIALS

For you: $${lead.for_you_amount ?? 0} labor including material
For us: $${lead.for_us_amount ?? 0} from total labor

Job Scheduled for: ${schedule}
${refLine}`;
    }

    // Default: basic copy
    return `Customer Name: ${lead.customer_name}
Customer Number: ${lead.customer_phone || ''}
Customer Address: ${lead.address || ''}
Service: ${lead.service_details || lead.service_type || ''}
Scheduled: ${schedule}`;
  };

  const handleCopy = () => {
    const text = generateText();
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('Lead details copied to clipboard');
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <>
      <Button
        variant="outline"
        size="sm"
<<<<<<< HEAD
        className={cn("gap-1.5 text-[11px]", className)}
=======
        className="gap-1.5 text-[11px]"
>>>>>>> 06a14ca75a4b59c1d58671f9a65a8cc79bc88a8f
        onClick={() => setOpen(true)}
      >
        <Copy className="h-3 w-3" />
        Copy Details
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base">Copy Lead Details</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/60">Customer # (manual)</Label>
              <Input
                value={customerNumber}
                onChange={e => setCustomerNumber(e.target.value)}
                placeholder="Enter customer number..."
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[11px] font-medium text-muted-foreground/60">Reference Name (manual)</Label>
              <Input
                value={referenceName}
                onChange={e => setReferenceName(e.target.value)}
                placeholder="Reference person name..."
              />
            </div>

            {/* Preview */}
            <div className="rounded-lg border border-border/40 bg-muted/20 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/50 mb-2">Preview</p>
              <pre className="text-[12px] text-foreground whitespace-pre-wrap font-sans leading-relaxed">
                {generateText()}
              </pre>
            </div>

            {!isFreeEstimate && !isQuoted && (
              <p className="text-[11px] text-muted-foreground/60 text-center">
                Set "Terms" in Processor Details to get the full formatted copy (Free Estimate or Quoted).
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Close</Button>
            <Button onClick={handleCopy} className="gap-1.5">
              {copied ? <><Check className="h-3.5 w-3.5" /> Copied!</> : <><Copy className="h-3.5 w-3.5" /> Copy to Clipboard</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
