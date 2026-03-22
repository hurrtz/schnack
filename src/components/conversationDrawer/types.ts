import { ConversationMeta } from "../../types";

export interface ConversationDrawerProps {
  visible: boolean;
  conversations: ConversationMeta[];
  activeId: string | null;
  onSearchConversations: (query: string) => Promise<ConversationMeta[]>;
  onSelect: (id: string) => Promise<void> | void;
  onCopyThread: (id: string) => void;
  onShareThread: (id: string) => void;
  onManageMemory: (id: string) => void;
  onRenameThread: (id: string, title: string) => void;
  onTogglePinned: (id: string) => void;
  onNewSession: () => Promise<void> | void;
  onDelete: (id: string) => void;
  onClose: () => void;
  onDismiss?: () => void;
}
