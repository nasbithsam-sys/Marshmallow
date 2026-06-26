export type Priority = "High" | "Medium" | "Low";
export type LeadStatus = "Important" | "Needs Follow-Up" | "Delayed Reply" | "Dead Lead" | "All Good";

export interface QuoMessage {
  id: string;
  sender: "customer" | "agent";
  text: string;
  time: string;
}

export interface QuoConversation {
  id: string;
  customerName: string;
  customerNumber: string;
  numberName: string;
  lastMessagePreview: string;
  lastMessageTime: string;
  direction: "incoming" | "outgoing";
  priority: Priority;
  status: LeadStatus;
  messages: QuoMessage[];
  analysis: {
    aiRuleResult: string;
    reason: string;
    suggestedAction: string;
    lastCustomerReplyTime: string;
    lastAgentReplyTime: string;
    responseDelay: string;
  };
}

export interface QuoNumberStat {
  id: string;
  numberName: string;
  incomingToday: number;
  outgoingToday: number;
  needsFollowUp: number;
  importantLeads: number;
  delayedReplies: number;
  deadConversations: number;
}

export const mockConversations: QuoConversation[] = [
  {
    id: "conv_1",
    customerName: "John Doe",
    customerNumber: "+1 (555) 123-4567",
    numberName: "Main Support Line",
    lastMessagePreview: "I need a quote for a new roof.",
    lastMessageTime: "10:30 AM",
    direction: "incoming",
    priority: "High",
    status: "Important",
    messages: [
      { id: "m1", sender: "customer", text: "Hi, I'm looking for a quote.", time: "10:25 AM" },
      { id: "m2", sender: "agent", text: "Hello! We can help with that. What kind of service do you need?", time: "10:28 AM" },
      { id: "m3", sender: "customer", text: "I need a quote for a new roof.", time: "10:30 AM" },
    ],
    analysis: {
      aiRuleResult: "High Intent Lead",
      reason: "Customer explicitly asked for a quote for a high-value service.",
      suggestedAction: "Create Lead and schedule a call immediately.",
      lastCustomerReplyTime: "10:30 AM",
      lastAgentReplyTime: "10:28 AM",
      responseDelay: "None - Action Required",
    },
  },
  {
    id: "conv_2",
    customerName: "Sarah Smith",
    customerNumber: "+1 (555) 987-6543",
    numberName: "Sales Line",
    lastMessagePreview: "Can we reschedule?",
    lastMessageTime: "Yesterday",
    direction: "incoming",
    priority: "Medium",
    status: "Needs Follow-Up",
    messages: [
      { id: "m4", sender: "agent", text: "Hi Sarah, your appointment is set for tomorrow at 2 PM.", time: "Yesterday, 9:00 AM" },
      { id: "m5", sender: "customer", text: "Can we reschedule?", time: "Yesterday, 4:30 PM" },
    ],
    analysis: {
      aiRuleResult: "Reschedule Request",
      reason: "Customer asked to change appointment time.",
      suggestedAction: "Contact to find a new time slot.",
      lastCustomerReplyTime: "Yesterday, 4:30 PM",
      lastAgentReplyTime: "Yesterday, 9:00 AM",
      responseDelay: "Over 12 hours",
    },
  },
  {
    id: "conv_3",
    customerName: "Michael Brown",
    customerNumber: "+1 (555) 456-7890",
    numberName: "Main Support Line",
    lastMessagePreview: "Stop messaging me.",
    lastMessageTime: "2 Days Ago",
    direction: "incoming",
    priority: "Low",
    status: "Dead Lead",
    messages: [
      { id: "m6", sender: "agent", text: "Just checking in if you received our quote.", time: "3 Days Ago" },
      { id: "m7", sender: "customer", text: "Stop messaging me.", time: "2 Days Ago" },
    ],
    analysis: {
      aiRuleResult: "Opt-Out",
      reason: "Customer requested no further contact.",
      suggestedAction: "Mark as dead and do not contact.",
      lastCustomerReplyTime: "2 Days Ago",
      lastAgentReplyTime: "3 Days Ago",
      responseDelay: "N/A",
    },
  },
  {
    id: "conv_4",
    customerName: "Emily Davis",
    customerNumber: "+1 (555) 222-3333",
    numberName: "Service Line",
    lastMessagePreview: "I'll think about it and let you know.",
    lastMessageTime: "3 Hours Ago",
    direction: "outgoing",
    priority: "Medium",
    status: "Delayed Reply",
    messages: [
      { id: "m8", sender: "customer", text: "How much would it cost?", time: "5 Hours Ago" },
      { id: "m9", sender: "agent", text: "It depends on the square footage. Roughly $500.", time: "4 Hours Ago" },
      { id: "m10", sender: "customer", text: "I'll think about it and let you know.", time: "3 Hours Ago" },
    ],
    analysis: {
      aiRuleResult: "Pending Decision",
      reason: "Customer is considering the price.",
      suggestedAction: "Follow up in 2-3 days if no response.",
      lastCustomerReplyTime: "3 Hours Ago",
      lastAgentReplyTime: "4 Hours Ago",
      responseDelay: "Agent needs to reply (3 hours elapsed)",
    },
  },
  {
    id: "conv_5",
    customerName: "Unknown",
    customerNumber: "+1 (555) 888-9999",
    numberName: "Sales Line",
    lastMessagePreview: "Checking if you cover the north area?",
    lastMessageTime: "10 Mins Ago",
    direction: "incoming",
    priority: "High",
    status: "Important",
    messages: [
      { id: "m11", sender: "customer", text: "Checking if you cover the north area?", time: "10 Mins Ago" },
    ],
    analysis: {
      aiRuleResult: "New Inquiry",
      reason: "First message asking about service area.",
      suggestedAction: "Confirm service area and ask for details.",
      lastCustomerReplyTime: "10 Mins Ago",
      lastAgentReplyTime: "N/A",
      responseDelay: "None - Action Required",
    },
  }
];

export const mockNumberStats: QuoNumberStat[] = [
  {
    id: "n1",
    numberName: "Main Support Line",
    incomingToday: 145,
    outgoingToday: 112,
    needsFollowUp: 12,
    importantLeads: 5,
    delayedReplies: 8,
    deadConversations: 2,
  },
  {
    id: "n2",
    numberName: "Sales Line",
    incomingToday: 89,
    outgoingToday: 95,
    needsFollowUp: 24,
    importantLeads: 15,
    delayedReplies: 4,
    deadConversations: 1,
  },
  {
    id: "n3",
    numberName: "Service Line",
    incomingToday: 56,
    outgoingToday: 48,
    needsFollowUp: 5,
    importantLeads: 2,
    delayedReplies: 10,
    deadConversations: 0,
  }
];
