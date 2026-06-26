import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import QuoPhoneTrigger from "@/components/leads/QuoPhoneTrigger";
import { useAuth } from "@/contexts/AuthContext";
import { fetchQuoChatThread } from "@/lib/quo-chat";

vi.mock("@/contexts/AuthContext", () => ({
  useAuth: vi.fn(),
}));

vi.mock("@/lib/quo-chat", () => ({
  fetchQuoChatThread: vi.fn().mockResolvedValue({
    contact: { participant: "+15551234567" },
    phoneNumber: {
      id: "PN123",
      number: "+15551230000",
      formattedNumber: "+1 (555) 123-0000",
      name: "Main Line",
    },
    conversation: null,
    messages: [],
  }),
  sendQuoChatMessage: vi.fn(),
}));

describe("QuoPhoneTrigger", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("opens the Quo drawer for admins and shows a normalized phone number", async () => {
    vi.mocked(useAuth).mockReturnValue({
      role: "admin",
    } as ReturnType<typeof useAuth>);

    render(
      <QuoPhoneTrigger contactName="Jane Doe" phone="(555) 123-4567">
        (555) 123-4567
      </QuoPhoneTrigger>,
    );

    fireEvent.click(screen.getByRole("button", { name: /\(555\) 123-4567/i }));

    expect(await screen.findByText("Quo messages will appear here")).toBeInTheDocument();
    expect(screen.getByText("+15551234567")).toBeInTheDocument();
    expect(screen.getByText("Jane Doe")).toBeInTheDocument();
    expect(fetchQuoChatThread).toHaveBeenCalledWith("+15551234567");
  });

  it("renders plain text for non-admin users", () => {
    vi.mocked(useAuth).mockReturnValue({
      role: "customer_service",
    } as ReturnType<typeof useAuth>);

    render(
      <QuoPhoneTrigger contactName="Jane Doe" phone="(555) 123-4567">
        (555) 123-4567
      </QuoPhoneTrigger>,
    );

    expect(screen.queryByRole("button", { name: /\(555\) 123-4567/i })).not.toBeInTheDocument();
    expect(screen.getByText("(555) 123-4567")).toBeInTheDocument();
  });
});
