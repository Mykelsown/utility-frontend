import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render } from "@testing-library/react";
import { ServiceWorkerProvider } from "../../src/components/providers/ServiceWorkerProvider";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createMockRegistration(): any {
  const listeners: Array<{
    type: string;
    handler: EventListenerOrEventListenerObject;
  }> = [];
  const state = "installing";

  const mockInstalling = {
    state,
    addEventListener: vi.fn(
      (event: string, handler: EventListenerOrEventListenerObject) => {
        listeners.push({ type: event, handler });
      }
    ),
  };

  const mockRegistration = {
    installing: mockInstalling,
    addEventListener: vi.fn(
      (event: string, handler: EventListenerOrEventListenerObject) => {
        listeners.push({ type: event, handler });
      }
    ),
    _triggerStateChange: (newState: string) => {
      mockInstalling.state = newState;
      listeners
        .filter((l) => l.type === "statechange")
        .forEach((l) => {
          if (typeof l.handler === "function") {
            l.handler(new Event("statechange"));
          } else {
            l.handler.handleEvent(new Event("statechange"));
          }
        });
    },
    _triggerUpdateFound: () => {
      listeners
        .filter((l) => l.type === "updatefound")
        .forEach((l) => {
          if (typeof l.handler === "function") {
            l.handler(new Event("updatefound"));
          } else {
            l.handler.handleEvent(new Event("updatefound"));
          }
        });
    },
  };

  return mockRegistration;
}

describe("ServiceWorkerProvider", () => {
  let originalServiceWorker: ServiceWorkerContainer | undefined;

  beforeEach(() => {
    originalServiceWorker = (navigator as { serviceWorker?: ServiceWorkerContainer })
      .serviceWorker;
    // @ts-expect-error – mock serviceWorker for tests
    navigator.serviceWorker = undefined;
  });

  afterEach(() => {
    // @ts-expect-error – restore original
    navigator.serviceWorker = originalServiceWorker;
    vi.restoreAllMocks();
  });

  it("should register the service worker when supported", async () => {
    const mockReg = createMockRegistration();
    const registerMock = vi.fn().mockResolvedValue(mockReg);

    // @ts-expect-error – mock serviceWorker
    navigator.serviceWorker = {
      register: registerMock,
      controller: null,
      addEventListener: vi.fn(),
    };

    render(
      <ServiceWorkerProvider>
        <div>App content</div>
      </ServiceWorkerProvider>
    );

    // Wait for useEffect
    await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith("/sw.js", { scope: "/" });
    });
  });

  it("should render children", () => {
    // @ts-expect-error – mock serviceWorker
    navigator.serviceWorker = {
      register: vi.fn().mockResolvedValue(createMockRegistration()),
      controller: null,
      addEventListener: vi.fn(),
    };

    const { getByText } = render(
      <ServiceWorkerProvider>
        <div>App content</div>
      </ServiceWorkerProvider>
    );

    expect(getByText("App content")).toBeDefined();
  });

  it("should not crash when service workers are unsupported", () => {
    // navigator.serviceWorker is already undefined from beforeEach

    const { getByText } = render(
      <ServiceWorkerProvider>
        <div>No SW support</div>
      </ServiceWorkerProvider>
    );

    expect(getByText("No SW support")).toBeDefined();
  });

  it("should handle registration failure gracefully", async () => {
    const consoleWarnSpy = vi
      .spyOn(console, "warn")
      .mockImplementation(() => {});

    // @ts-expect-error – mock serviceWorker
    navigator.serviceWorker = {
      register: vi.fn().mockRejectedValue(new Error("SW registration failed")),
      controller: null,
      addEventListener: vi.fn(),
    };

    const { getByText } = render(
      <ServiceWorkerProvider>
        <div>Content</div>
      </ServiceWorkerProvider>
    );

    await vi.waitFor(() => {
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        "[SW] Registration failed:",
        "SW registration failed"
      );
    });

    expect(getByText("Content")).toBeDefined();
    consoleWarnSpy.mockRestore();
  });

  it("should listen for updatefound event", async () => {
    const mockReg = createMockRegistration();
    const registerMock = vi.fn().mockResolvedValue(mockReg);

    // @ts-expect-error – mock serviceWorker
    navigator.serviceWorker = {
      register: registerMock,
      controller: null,
      addEventListener: vi.fn(),
    };

    render(
      <ServiceWorkerProvider>
        <div>Content</div>
      </ServiceWorkerProvider>
    );

    await vi.waitFor(() => {
      expect(registerMock).toHaveBeenCalled();
    });

    expect(mockReg.addEventListener).toHaveBeenCalledWith(
      "updatefound",
      expect.any(Function)
    );
  });

  it("should guard against missing navigator.serviceWorker", () => {
    // navigator.serviceWorker is already undefined from beforeEach
    const registerSpy = vi.fn();

    // @ts-expect-error – mock serviceWorker
    navigator.serviceWorker = undefined;

    // Should not throw
    const { getByText } = render(
      <ServiceWorkerProvider>
        <div>Safe render</div>
      </ServiceWorkerProvider>
    );

    expect(getByText("Safe render")).toBeDefined();
    expect(registerSpy).not.toHaveBeenCalled();
  });
});
