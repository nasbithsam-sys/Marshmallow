import React, { createContext, useContext, useState, useCallback } from "react";
import { useAuth } from "./AuthContext";

interface NotepadContextType {
  activeUserIds: string[];
  isPickerOpen: boolean;
  openNotepad: (userId?: string) => void;
  closeNotepad: (userId?: string) => void;
  toggleNotepad: (userId?: string) => void;
  openPicker: () => void;
  closePicker: () => void;
  isNotepadOpen: (userId?: string) => boolean;
}

const NotepadContext = createContext<NotepadContextType | null>(null);

export const useNotepad = () => {
  const context = useContext(NotepadContext);
  if (!context) {
    throw new Error("useNotepad must be used within a NotepadProvider");
  }
  return context;
};

export const NotepadProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, role } = useAuth();
  const [activeUserIds, setActiveUserIds] = useState<string[]>([]);
  const [isPickerOpen, setIsPickerOpen] = useState(false);

  const openNotepad = useCallback(
    (userId?: string) => {
      const targetId = userId || user?.id;
      if (!targetId) return;

      setActiveUserIds((prev) => {
        if (!prev.includes(targetId)) {
          return [...prev, targetId];
        }
        return prev;
      });
    },
    [user?.id]
  );

  const closeNotepad = useCallback(
    (userId?: string) => {
      const targetId = userId || user?.id;
      if (!targetId) return;

      setActiveUserIds((prev) => prev.filter((id) => id !== targetId));
    },
    [user?.id]
  );

  const isNotepadOpen = useCallback(
    (userId?: string) => {
      const targetId = userId || user?.id;
      if (!targetId) return false;
      return activeUserIds.includes(targetId);
    },
    [activeUserIds, user?.id]
  );

  const openPicker = useCallback(() => {
    setIsPickerOpen(true);
  }, []);

  const closePicker = useCallback(() => {
    setIsPickerOpen(false);
  }, []);

  const toggleNotepad = useCallback(
    (userId?: string) => {
      if (role === "admin") {
        if (userId) {
          if (activeUserIds.includes(userId)) {
            closeNotepad(userId);
          } else {
            openNotepad(userId);
          }
        } else {
          // Clicking Notepad button as admin opens user picker pop-up!
          setIsPickerOpen((prev) => !prev);
        }
      } else {
        const targetId = userId || user?.id;
        if (!targetId) return;
        if (activeUserIds.includes(targetId)) {
          closeNotepad(targetId);
        } else {
          openNotepad(targetId);
        }
      }
    },
    [role, user?.id, activeUserIds, openNotepad, closeNotepad]
  );

  return (
    <NotepadContext.Provider
      value={{
        activeUserIds,
        isPickerOpen,
        openNotepad,
        closeNotepad,
        toggleNotepad,
        openPicker,
        closePicker,
        isNotepadOpen,
      }}
    >
      {children}
    </NotepadContext.Provider>
  );
};
