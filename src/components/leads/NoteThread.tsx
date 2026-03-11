import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface LeadNote {
  id: string;
  lead_id: string;
  user_id: string;
  note_type: string;
  content: string;
  created_at: string;
}

interface Props {
  leadId: string;
  noteType: "cs" | "processor" | "general";
  label: string;
  profiles: Record<string, string>;
}

export default function NoteThread({ leadId, noteType, label, profiles }: Props) {
  const { user } = useAuth();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchNotes();
  }, [leadId, noteType]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [notes]);

  const fetchNotes = async () => {
    const { data } = await supabase
      .from("lead_notes")
      .select("*")
      .eq("lead_id", leadId)
      .eq("note_type", noteType)
      .order("created_at", { ascending: true });
    if (data) setNotes(data as LeadNote[]);
  };

  const handleSend = async () => {
    if (!newNote.trim() || !user) return;
    setSending(true);
    const { error } = await supabase.from("lead_notes").insert({
      lead_id: leadId,
      user_id: user.id,
      note_type: noteType,
      content: newNote.trim(),
    });
    if (!error) {
      setNewNote("");
      await fetchNotes();
    }
    setSending(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const getInitials = (userId: string) => {
    const name = profiles[userId] || "?";
    return name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);
  };

  return (
    <div className="rounded-xl border border-border/40 bg-card overflow-hidden">
      <div className="px-4 py-2.5 border-b border-border/30 bg-muted/20">
        <h4 className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/50">{label}</h4>
      </div>

      <div ref={scrollRef} className="max-h-60 overflow-y-auto p-3 space-y-3">
        {notes.length === 0 && (
          <p className="text-[12px] text-muted-foreground/40 text-center py-6">No notes yet. Start the conversation.</p>
        )}
        <AnimatePresence initial={false}>
          {notes.map((note) => {
            const isMe = note.user_id === user?.id;
            return (
              <motion.div
                key={note.id}
                initial={{ opacity: 0, y: 6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: "spring", stiffness: 320, damping: 28 }}
                className={`flex gap-2.5 ${isMe ? "flex-row-reverse" : ""}`}
              >
                <Avatar className="h-6 w-6 shrink-0">
                  <AvatarFallback className={`text-[8px] font-bold ${isMe ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {getInitials(note.user_id)}
                  </AvatarFallback>
                </Avatar>
                <div className={`max-w-[75%] space-y-0.5 ${isMe ? "items-end text-right" : ""}`}>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] font-medium text-foreground">
                      {profiles[note.user_id] || "Unknown"}
                    </span>
                    <span className="text-[9px] text-muted-foreground/40">
                      {new Date(note.created_at).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                    isMe
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : "bg-muted/50 text-foreground rounded-tl-sm border border-border/30"
                  }`}>
                    {note.content}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <div className="border-t border-border/30 p-2 flex gap-2">
        <Textarea
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={`Add a note...`}
          className="min-h-[36px] max-h-20 text-sm resize-none border-0 bg-transparent focus-visible:ring-0 shadow-none"
          rows={1}
        />
        <Button size="icon" className="h-9 w-9 shrink-0 rounded-lg" onClick={handleSend} disabled={sending || !newNote.trim()}>
          <Send className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
