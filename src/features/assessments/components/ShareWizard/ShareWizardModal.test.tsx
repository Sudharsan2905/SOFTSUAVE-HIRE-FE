import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { ShareWizardModal } from "./ShareWizardModal";

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("@/utils/api", () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: { request: { use: vi.fn() }, response: { use: vi.fn() } },
  },
  extractApiErrorMessage: (_e: unknown, fb: string) => fb,
}));

vi.mock("react-hot-toast", () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/constants/api", () => ({
  API_ENDPOINTS: {
    ASSESSMENTS: {
      SHARES: (wsId: string, aId: string) =>
        `/workspaces/${wsId}/assessments/${aId}/shares`,
      SHARE_BY_ID: (wsId: string, aId: string, sId: string) =>
        `/workspaces/${wsId}/assessments/${aId}/shares/${sId}`,
    },
  },
}));

// Modal — renders children + footer unconditionally (unless explicitly closed)
vi.mock("@/components/ui/Modal", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Modal: ({ children, title, footer, onClose, isOpen }: any) =>
    isOpen === false ? null : (
      <div data-testid="modal">
        <h2 data-testid="modal-title">{title}</h2>
        <button data-testid="modal-close" onClick={onClose}>
          X
        </button>
        <div data-testid="modal-content">{children}</div>
        {footer}
      </div>
    ),
}));

vi.mock("@/components/ui/Button", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Button: ({ children, onClick, disabled, isLoading, leftIcon, variant, title }: any) => (
    <button
      onClick={onClick}
      disabled={disabled || isLoading}
      data-loading={isLoading ? "true" : "false"}
      data-variant={variant}
      title={title}
    >
      {leftIcon}
      {children}
    </button>
  ),
}));

vi.mock("@/components/ui/Input", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Input: ({ label, id, value, onChange, error, placeholder, hint }: any) => (
    <div>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        aria-label={label}
        value={value}
        placeholder={placeholder}
        onChange={onChange}
      />
      {hint && <span>{hint}</span>}
      {error && <span data-testid={`error-${id}`}>{error}</span>}
    </div>
  ),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  NumberField: ({ label, id, value, onValueChange, rightElement, min, max }: any) => (
    <div>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        type="number"
        aria-label={label}
        value={value}
        min={min}
        max={max}
        onChange={(e) => onValueChange(Number(e.target.value))}
      />
      {rightElement}
    </div>
  ),
}));

vi.mock("@/components/ui/Select", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Select: ({ label, value, onChange, options }: any) => (
    <div>
      {label && <label>{label}</label>}
      <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>
        {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
        {options?.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  ),
}));

vi.mock("@/components/datetime/DateTimePicker", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  DateTimePicker: ({ label, id, value, onChange, error }: any) => (
    <div>
      {label && <label htmlFor={id}>{label}</label>}
      <input
        id={id}
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <span data-testid={`error-${id}`}>{error}</span>}
    </div>
  ),
}));

vi.mock("../CreateWizard/SkeuToggle", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SkeuToggle: ({ checked, onChange }: any) => (
    <button
      role="switch"
      aria-checked={checked}
      data-testid="skeu-toggle"
      onClick={() => onChange(!checked)}
    >
      toggle
    </button>
  ),
}));

vi.mock("@/utils/helpers", () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clsx: (...args: any[]) => args.filter(Boolean).join(" "),
}));

// Icons — simple stubs
vi.mock("@/assets/icons", () => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const make = (name: string) => (props: any) =>
    <span data-testid={`icon-${name}`} {...props} />;
  return {
    IconCopy: make("copy"),
    IconCheck: make("check"),
    IconDelete: make("delete"),
    IconGlobe: make("globe"),
    IconShield: make("shield"),
    IconClock: make("clock"),
    IconArrowRight: make("arrow-right"),
    IconLink: make("link"),
    IconChevronDown: make("chevron-down"),
    IconChevronUp: make("chevron-up"),
    IconSettings: make("settings"),
    IconMonitor: make("monitor"),
    IconMic: make("mic"),
    IconCamera: make("camera"),
    IconVideoCamera: make("video-camera"),
    IconWhatsApp: make("whatsapp"),
    IconMail: make("mail"),
    IconSlack: make("slack"),
    IconMSTeams: make("msteams"),
  };
});

vi.mock("./ShareWizard.module.css", () => ({ default: {} }));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { api } from "@/utils/api";
import toast from "react-hot-toast";

const mockGet = api.get as ReturnType<typeof vi.fn>;
const mockPost = api.post as ReturnType<typeof vi.fn>;
const mockDelete = api.delete as ReturnType<typeof vi.fn>;
const mockToastSuccess = toast.success as ReturnType<typeof vi.fn>;
const mockToastError = toast.error as ReturnType<typeof vi.fn>;

let writeText: ReturnType<typeof vi.fn>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const assessment = {
  id: "assess-1",
  name: "Frontend Test",
  share_link: "abc123",
  workspace_id: "ws-1",
};

const defaultProps = {
  isOpen: true,
  onClose: vi.fn(),
  assessment,
};

function makeShareLink(overrides: Record<string, unknown> = {}) {
  return {
    id: "share-1",
    share_type: "custom",
    label: "Weekend Link",
    share_link: "custom-abc",
    start_time: null,
    end_time: null,
    is_active: true,
    created_at: "2024-01-01T10:00:00Z",
    ...overrides,
  };
}

function renderModal(props: Partial<typeof defaultProps> = {}) {
  return render(<ShareWizardModal {...defaultProps} {...props} />);
}

// userEvent.setup() installs its own navigator.clipboard stub. Call this AFTER
// setup() so the component reads our spy instead of userEvent's internal one.
function installClipboardSpy() {
  writeText = vi.fn().mockResolvedValue(undefined);
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
  return writeText;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  mockGet.mockReset();
  mockPost.mockReset();
  mockDelete.mockReset();
  mockToastSuccess.mockReset();
  mockToastError.mockReset();
  defaultProps.onClose = vi.fn();

  // Default: no existing links
  mockGet.mockResolvedValue({ data: { data: { shares: [] } } });
  mockPost.mockResolvedValue({ data: { data: makeShareLink() } });
  mockDelete.mockResolvedValue({ data: {} });

  writeText = vi.fn().mockResolvedValue(undefined);
  // Define as a getter so userEvent.setup() cannot replace the spy.
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    get: () => ({ writeText }),
  });
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ShareWizardModal", () => {
  // ── Render / closed state ────────────────────────────────────────────────

  it("renders the modal with the assessment name in the title", () => {
    renderModal();
    expect(screen.getByTestId("modal-title")).toHaveTextContent("Share — Frontend Test");
  });

  it("does not render content when isOpen is false", () => {
    renderModal({ isOpen: false });
    expect(screen.queryByTestId("modal")).not.toBeInTheDocument();
  });

  it("renders both tab buttons (Permanent Link & Custom Link)", () => {
    renderModal();
    expect(screen.getByRole("tab", { name: /permanent link/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /custom link/i })).toBeInTheDocument();
  });

  it("defaults to the Permanent tab", () => {
    renderModal();
    const permTab = screen.getByRole("tab", { name: /permanent link/i });
    expect(permTab).toHaveAttribute("aria-selected", "true");
  });

  it("calls onClose when the modal close button is clicked", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByTestId("modal-close"));
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });

  // ── Permanent tab ────────────────────────────────────────────────────────

  it("renders the permanent share link URL in a readonly input", () => {
    renderModal();
    const input = screen.getByLabelText("Permanent share link") as HTMLInputElement;
    expect(input.value).toContain("/assessment/abc123");
    expect(input).toHaveAttribute("readonly");
  });

  it("shows the 'Copy Link' primary CTA on the permanent tab", () => {
    renderModal();
    expect(screen.getByRole("button", { name: /copy link/i })).toBeInTheDocument();
  });

  it("copies the permanent link to the clipboard and shows 'Link Copied!'", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    renderModal();
    await user.click(screen.getByRole("button", { name: /copy link/i }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/assessment/abc123")
    );
    expect(await screen.findByText("Link Copied!")).toBeInTheDocument();
  });

  it("shows an error toast when clipboard copy fails on the permanent tab", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    writeText.mockRejectedValueOnce(new Error("denied"));
    renderModal();
    await user.click(screen.getByRole("button", { name: /copy link/i }));
    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Copy failed — please copy manually.")
    );
  });

  it("renders share chips for WhatsApp, Email, Teams and Slack", () => {
    renderModal();
    expect(screen.getByText("WhatsApp")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Teams")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
  });

  it("builds a WhatsApp share href that contains the encoded link", () => {
    renderModal();
    const link = screen.getByText("WhatsApp").closest("a")!;
    expect(link).toHaveAttribute("href", expect.stringContaining("wa.me"));
    expect(link.getAttribute("href")).toContain("abc123");
  });

  it("copies the link to clipboard when the Slack chip is clicked", async () => {
    const user = userEvent.setup();
    installClipboardSpy();
    renderModal();
    await user.click(screen.getByText("Slack").closest("a")!);
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/assessment/abc123")
    );
  });

  // ── Tab switching ────────────────────────────────────────────────────────

  it("switches to the Custom tab when its tab button is clicked", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    expect(screen.getByRole("tab", { name: /custom link/i })).toHaveAttribute(
      "aria-selected",
      "true"
    );
    expect(screen.getByLabelText("Link Label")).toBeInTheDocument();
  });

  // ── Custom tab: fetch existing links ───────────────────────────────────────

  it("fetches custom links when the Custom tab is opened with the share_type=custom query", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await waitFor(() =>
      expect(mockGet).toHaveBeenCalledWith(
        expect.stringContaining(
          "/workspaces/ws-1/assessments/assess-1/shares?share_type=custom"
        )
      )
    );
  });

  it("shows the empty hint when there are no existing custom links", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    expect(
      await screen.findByText(/no custom links yet/i)
    ).toBeInTheDocument();
  });

  it("renders existing active custom links returned from the API", async () => {
    mockGet.mockResolvedValue({
      data: { data: { shares: [makeShareLink({ label: "My Saved Link" })] } },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    expect(await screen.findByText("My Saved Link")).toBeInTheDocument();
  });

  it("filters out inactive links from the existing links list", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          shares: [
            makeShareLink({ id: "a", label: "Active One", is_active: true }),
            makeShareLink({ id: "b", label: "Inactive One", is_active: false }),
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    expect(await screen.findByText("Active One")).toBeInTheDocument();
    expect(screen.queryByText("Inactive One")).not.toBeInTheDocument();
  });

  // ── Custom tab: validation ─────────────────────────────────────────────────

  it("shows a label-required error when generating without a label", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await screen.findByText(/no custom links yet/i);
    await user.click(screen.getByRole("button", { name: /generate link/i }));
    expect(await screen.findByText("Label is required")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });

  // ── Custom tab: generate link ──────────────────────────────────────────────

  it("posts a new custom link and shows a success toast", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await screen.findByText(/no custom links yet/i);

    await user.type(screen.getByLabelText("Link Label"), "Weekend Link");
    await user.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() =>
      expect(mockPost).toHaveBeenCalledWith(
        "/workspaces/ws-1/assessments/assess-1/shares",
        expect.objectContaining({
          share_type: "custom",
          label: "Weekend Link",
          monitoring_overrides: expect.any(Object),
        })
      )
    );
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Custom link generated")
    );
  });

  it("adds the newly-generated link to the existing links list", async () => {
    mockPost.mockResolvedValue({
      data: { data: makeShareLink({ id: "new-1", label: "Brand New Link" }) },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await screen.findByText(/no custom links yet/i);

    await user.type(screen.getByLabelText("Link Label"), "Brand New Link");
    await user.click(screen.getByRole("button", { name: /generate link/i }));

    expect(await screen.findByText("Brand New Link")).toBeInTheDocument();
  });

  it("shows an error toast when generating a custom link fails", async () => {
    mockPost.mockRejectedValue({
      response: { data: { message: "Server rejected the link" } },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await screen.findByText(/no custom links yet/i);

    await user.type(screen.getByLabelText("Link Label"), "Will Fail");
    await user.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Server rejected the link")
    );
  });

  it("falls back to a default error message when no server message is present", async () => {
    mockPost.mockRejectedValue(new Error("network"));
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await screen.findByText(/no custom links yet/i);

    await user.type(screen.getByLabelText("Link Label"), "Will Fail");
    await user.click(screen.getByRole("button", { name: /generate link/i }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Failed to generate custom link")
    );
  });

  // ── Custom tab: monitoring overrides ───────────────────────────────────────

  it("renders monitoring toggle rows inside the accordion", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    expect(screen.getByText("Tab Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Audio Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Video Monitoring")).toBeInTheDocument();
    expect(screen.getByText("Screenshot Capture")).toBeInTheDocument();
  });

  it("hides screenshot options when Screenshot Capture is toggled off", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    // Screenshot options visible by default
    expect(screen.getByLabelText("Screenshot mode")).toBeInTheDocument();
    // The 4th toggle is Screenshot Capture
    const toggles = screen.getAllByTestId("skeu-toggle");
    await user.click(toggles[3]);
    expect(screen.queryByLabelText("Screenshot mode")).not.toBeInTheDocument();
  });

  it("switches screenshot mode from interval to total count", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    expect(screen.getByLabelText("Interval (seconds)")).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Screenshot mode"), "count");
    expect(screen.getByLabelText("Total screenshots")).toBeInTheDocument();
    expect(screen.queryByLabelText("Interval (seconds)")).not.toBeInTheDocument();
  });

  // ── Custom tab: revoke ─────────────────────────────────────────────────────

  it("revokes an existing custom link and removes it from the list", async () => {
    mockGet.mockResolvedValue({
      data: { data: { shares: [makeShareLink({ id: "share-99", label: "Temp Link" })] } },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));

    // Expand the accordion card to reveal the Revoke button
    await user.click(await screen.findByText("Temp Link"));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(mockDelete).toHaveBeenCalledWith(
        "/workspaces/ws-1/assessments/assess-1/shares/share-99"
      )
    );
    await waitFor(() =>
      expect(mockToastSuccess).toHaveBeenCalledWith("Link revoked")
    );
    await waitFor(() =>
      expect(screen.queryByText("Temp Link")).not.toBeInTheDocument()
    );
  });

  it("shows an error toast when revoking a link fails", async () => {
    mockGet.mockResolvedValue({
      data: { data: { shares: [makeShareLink({ id: "share-99", label: "Temp Link" })] } },
    });
    mockDelete.mockRejectedValue({
      response: { data: { message: "Cannot revoke" } },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));

    await user.click(await screen.findByText("Temp Link"));
    await user.click(screen.getByRole("button", { name: "Revoke" }));

    await waitFor(() =>
      expect(mockToastError).toHaveBeenCalledWith("Cannot revoke")
    );
  });

  // ── Existing link card details ─────────────────────────────────────────────

  it("renders the link's full URL inside the expanded accordion card", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          shares: [
            makeShareLink({ id: "s1", label: "Detailed", share_link: "detail-xyz" }),
          ],
        },
      },
    });
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await user.click(await screen.findByText("Detailed"));

    const input = screen.getByLabelText("Detailed") as HTMLInputElement;
    expect(input.value).toContain("/assessment/detail-xyz");
  });

  it("copies an existing link's URL via its Copy button", async () => {
    mockGet.mockResolvedValue({
      data: {
        data: {
          shares: [
            makeShareLink({ id: "s1", label: "CopyMe", share_link: "copy-xyz" }),
          ],
        },
      },
    });
    const user = userEvent.setup();
    installClipboardSpy();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await user.click(await screen.findByText("CopyMe"));

    await user.click(screen.getByRole("button", { name: /^copy$/i }));
    expect(writeText).toHaveBeenCalledWith(
      expect.stringContaining("/assessment/copy-xyz")
    );
  });

  // ── Custom tab: date validation ───────────────────────────────────────────

  it("shows an 'after Opens On' error when end time precedes start time", async () => {
    const user = userEvent.setup();
    renderModal();
    await user.click(screen.getByRole("tab", { name: /custom link/i }));
    await screen.findByText(/no custom links yet/i);

    await user.type(screen.getByLabelText("Link Label"), "Bad Dates");
    // Future start, earlier end
    const start = "2999-12-31T10:00";
    const end = "2999-12-30T10:00";
    const startInput = screen.getByLabelText("Opens On");
    const endInput = screen.getByLabelText("Ends On");
    await user.type(startInput, start);
    await user.type(endInput, end);

    await user.click(screen.getByRole("button", { name: /generate link/i }));
    expect(await screen.findByText("Ends On must be after Opens On")).toBeInTheDocument();
    expect(mockPost).not.toHaveBeenCalled();
  });
});
