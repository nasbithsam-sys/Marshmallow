import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Send, Pencil, Check, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";

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
  const { user, role } = useAuth();
  const [notes, setNotes] = useState<LeadNote[]>([]);
  const [newNote, setNewNote] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const isAdmin = role === "admin";

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
    if (error) {
      toast.error("Failed to add note: " + error.message);
    } else {
      setNewNote("");
      await fetchNotes();
    }
    setSending(false);
  };

  const handleEdit = (note: LeadNote) => {
    setEditingId(note.id);
    setEditContent(note.content);
  };

  const handleSaveEdit = async () => {
    if (!editContent.trim() || !editingId) return;
    const { error } = await supabase
      .from("lead_notes")
      .update({ content: editContent.trim() })
      .eq("id", editingId);
    if (error) {
      toast.error("Failed to update note");
    } else {
      setEditingId(null);
      setEditContent("");
      await fetchNotes();
    }
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const canEdit = (note: LeadNote) => {
    if (isAdmin) return true;
    return note.user_id === user?.id;
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
            const isEditing = editingId === note.id;
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
                    {canEdit(note) && !isEditing && (
                      <button
                        onClick={() => handleEdit(note)}
                        className="opacity-0 group-hover/note:opacity-100 hover:opacity-100 focus:opacity-100 p-0.5 rounded hover:bg-muted transition-all"
                        title="Edit note"
                      >
                        <Pencil className="h-2.5 w-2.5 text-muted-foreground/60" />
                      </button>
                    )}
                  </div>
                  {isEditing ? (
                    <div className="space-y-1.5">
                      <Textarea
                        value={editContent}
                        onChange={(e) => setEditContent(e.target.value)}
                        className="min-h-[60px] text-[13px] resize-none"
                        autoFocus
                      />
                      <div className="flex gap-1 justify-end">
                        <Button size="icon" variant="ghost" className="h-6 w-6" onClick={handleCancelEdit}>
                          <X className="h-3 w-3" />
                        </Button>
                        <Button size="icon" className="h-6 w-6" onClick={handleSaveEdit}>
                          <Check className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={`group/note rounded-xl px-3 py-2 text-[13px] leading-relaxed relative ${
                        isMe
                          ? "bg-primary text-primary-foreground rounded-tr-sm"
                          : "bg-muted/50 text-foreground rounded-tl-sm border border-border/30"
                      }`}
                    >
                      {note.content}
                      {canEdit(note) && (
                        <button
                          onClick={() => handleEdit(note)}
                          className="absolute top-1 right-1 opacity-0 group-hover/note:opacity-100 p-1 rounded-md hover:bg-black/10 transition-all"
                          title="Edit"
                        >
                          <Pencil className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  )}
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
