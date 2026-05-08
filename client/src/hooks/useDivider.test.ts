import { renderHook, act } from "@testing-library/react";
import { useDivider } from "./useDivider";

// Helper: create a minimal PointerEvent-like object whose currentTarget
// has a known bounding rect so the hook can compute percentages.
function pointerEvent(
  clientX: number,
  rect: { left: number; width: number } = { left: 0, width: 1000 }
) {
  return {
    clientX,
    currentTarget: {
      getBoundingClientRect: () => ({
        left: rect.left,
        width: rect.width,
        top: 0,
        right: rect.left + rect.width,
        bottom: 0,
        height: 0,
        x: rect.left,
        y: 0,
        toJSON: () => {},
      }),
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    },
    pointerId: 1,
  } as any;
}

describe("useDivider", () => {
  it("returns leftPercent of 50 and isDragging false initially", () => {
    const { result } = renderHook(() => useDivider());

    expect(result.current.leftPercent).toBe(50);
    expect(result.current.isDragging).toBe(false);
  });

  it("updates leftPercent based on clientX position during drag", () => {
    const { result } = renderHook(() => useDivider());

    // Start drag
    act(() => {
      result.current.dividerProps.onPointerDown(pointerEvent(500));
    });

    // Move to 70% of a 1000px-wide container starting at left=0
    act(() => {
      result.current.containerProps.onPointerMove(pointerEvent(700));
    });

    expect(result.current.leftPercent).toBe(70);
  });

  it("clamps leftPercent to minimum of 20 when dragging far left", () => {
    const { result } = renderHook(() => useDivider());

    act(() => {
      result.current.dividerProps.onPointerDown(pointerEvent(500));
    });

    // Move to 5% of the container
    act(() => {
      result.current.containerProps.onPointerMove(pointerEvent(50));
    });

    expect(result.current.leftPercent).toBe(20);
  });

  it("clamps leftPercent to maximum of 80 when dragging far right", () => {
    const { result } = renderHook(() => useDivider());

    act(() => {
      result.current.dividerProps.onPointerDown(pointerEvent(500));
    });

    // Move to 95% of the container
    act(() => {
      result.current.containerProps.onPointerMove(pointerEvent(950));
    });

    expect(result.current.leftPercent).toBe(80);
  });

  it("resets leftPercent to 50 on double-click", () => {
    const { result } = renderHook(() => useDivider());

    // First drag to a non-50 value
    act(() => {
      result.current.dividerProps.onPointerDown(pointerEvent(500));
    });
    act(() => {
      result.current.containerProps.onPointerMove(pointerEvent(700));
    });
    act(() => {
      result.current.containerProps.onPointerUp(pointerEvent(700));
    });

    expect(result.current.leftPercent).toBe(70);

    // Double-click to reset
    act(() => {
      result.current.dividerProps.onDoubleClick();
    });

    expect(result.current.leftPercent).toBe(50);
  });

  it("sets isDragging to true during drag and false after pointer up", () => {
    const { result } = renderHook(() => useDivider());

    expect(result.current.isDragging).toBe(false);

    act(() => {
      result.current.dividerProps.onPointerDown(pointerEvent(500));
    });

    expect(result.current.isDragging).toBe(true);

    act(() => {
      result.current.containerProps.onPointerUp(pointerEvent(500));
    });

    expect(result.current.isDragging).toBe(false);
  });

  it("includes userSelect none in container style while dragging", () => {
    const { result } = renderHook(() => useDivider());

    // Not dragging: no userSelect restriction
    expect(result.current.containerProps.style).not.toHaveProperty(
      "userSelect",
      "none"
    );

    act(() => {
      result.current.dividerProps.onPointerDown(pointerEvent(500));
    });

    // Dragging: userSelect should be "none"
    expect(result.current.containerProps.style).toHaveProperty(
      "userSelect",
      "none"
    );

    act(() => {
      result.current.containerProps.onPointerUp(pointerEvent(500));
    });

    // After release: userSelect restriction removed
    expect(result.current.containerProps.style).not.toHaveProperty(
      "userSelect",
      "none"
    );
  });

  it("does not update leftPercent on pointer move when not dragging", () => {
    const { result } = renderHook(() => useDivider());

    // Move without starting a drag
    act(() => {
      result.current.containerProps.onPointerMove(pointerEvent(700));
    });

    expect(result.current.leftPercent).toBe(50);
  });
});
