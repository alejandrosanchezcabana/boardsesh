import { afterEach, describe, it, expect, vi } from 'vitest';
import React, { useRef, useEffect } from 'react';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import HoldTypePicker, { buildOptions } from '../hold-type-picker';

// Note: MUI Popover prints "anchorEl is invalid" warnings during the brief
// window between `cleanup()` and the Popover exit transition. They're benign
// noise specific to the test harness — the component itself is verified
// correct by the assertions below.

afterEach(() => {
  cleanup();
});

/**
 * Render the picker with the anchor element as a sibling inside the RTL
 * container so it gets unmounted by `cleanup()` rather than left dangling
 * in document.body across tests.
 */
function PickerHarness(
  props: Omit<React.ComponentProps<typeof HoldTypePicker>, 'anchorEl'> & {
    withAnchor: boolean;
  },
) {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const [anchor, setAnchor] = React.useState<HTMLDivElement | null>(null);

  useEffect(() => {
    if (props.withAnchor) {
      setAnchor(anchorRef.current);
    }
  }, [props.withAnchor]);

  return (
    <>
      <div ref={anchorRef} data-testid="anchor" />
      <HoldTypePicker {...props} anchorEl={anchor} />
    </>
  );
}

function renderPicker(
  overrides: Partial<React.ComponentProps<typeof HoldTypePicker>> & {
    withAnchor?: boolean;
  } = {},
) {
  const onSelect = vi.fn();
  const onClose = vi.fn();
  const { withAnchor = true, ...pickerProps } = overrides;

  const utils = render(
    <PickerHarness
      boardName="kilter"
      currentState="OFF"
      startingCount={0}
      finishCount={0}
      onSelect={onSelect}
      onClose={onClose}
      withAnchor={withAnchor}
      {...pickerProps}
    />,
  );

  return { ...utils, onSelect, onClose };
}

describe('buildOptions', () => {
  it('returns Start, Mid, Finish, Foot for Kilter', () => {
    const options = buildOptions('kilter');
    expect(options.map((o) => o.state)).toEqual(['STARTING', 'HAND', 'FINISH', 'FOOT']);
  });

  it('returns Start, Mid, Finish, Foot for Tension', () => {
    const options = buildOptions('tension');
    expect(options.map((o) => o.state)).toEqual(['STARTING', 'HAND', 'FINISH', 'FOOT']);
  });

  it('skips Foot for MoonBoard', () => {
    const options = buildOptions('moonboard');
    expect(options.map((o) => o.state)).toEqual(['STARTING', 'HAND', 'FINISH']);
    expect(options.map((o) => o.state)).not.toContain('FOOT');
  });

  it('uses board-specific colors', () => {
    const kilter = buildOptions('kilter');
    const moonboard = buildOptions('moonboard');

    // Kilter STARTING color from HOLD_STATE_MAP
    expect(kilter.find((o) => o.state === 'STARTING')?.color).toBe('#00FF00');
    // Kilter FOOT color
    expect(kilter.find((o) => o.state === 'FOOT')?.color).toBe('#FFAA00');
    // MoonBoard STARTING uses displayColor
    expect(moonboard.find((o) => o.state === 'STARTING')?.color).toBe('#44FF44');
  });
});

describe('HoldTypePicker', () => {
  it('renders all four hold types and Clear for Aurora boards', () => {
    renderPicker({ boardName: 'kilter' });

    expect(screen.getByLabelText('Start')).toBeTruthy();
    expect(screen.getByLabelText('Mid')).toBeTruthy();
    expect(screen.getByLabelText('Finish')).toBeTruthy();
    expect(screen.getByLabelText('Foot')).toBeTruthy();
    expect(screen.getByLabelText('Clear')).toBeTruthy();
  });

  it('omits Foot for MoonBoard', () => {
    renderPicker({ boardName: 'moonboard' });

    expect(screen.getByLabelText('Start')).toBeTruthy();
    expect(screen.getByLabelText('Mid')).toBeTruthy();
    expect(screen.getByLabelText('Finish')).toBeTruthy();
    expect(screen.queryByLabelText('Foot')).toBeNull();
    expect(screen.getByLabelText('Clear')).toBeTruthy();
  });

  it('does not render when anchorEl is null', () => {
    renderPicker({ withAnchor: false });

    // Popover is closed → no swatches should be in the DOM.
    expect(screen.queryByLabelText('Start')).toBeNull();
  });

  it('calls onSelect when a swatch is clicked', () => {
    const { onSelect } = renderPicker({ boardName: 'kilter' });

    fireEvent.click(screen.getByLabelText('Start'));
    expect(onSelect).toHaveBeenCalledWith('STARTING');

    fireEvent.click(screen.getByLabelText('Foot'));
    expect(onSelect).toHaveBeenCalledWith('FOOT');
  });

  it('calls onSelect with OFF when Clear is clicked', () => {
    const { onSelect } = renderPicker({
      boardName: 'kilter',
      currentState: 'STARTING',
    });

    fireEvent.click(screen.getByLabelText('Clear'));
    expect(onSelect).toHaveBeenCalledWith('OFF');
  });

  it('disables STARTING when startingCount is at the max of 2', () => {
    const { onSelect } = renderPicker({
      boardName: 'kilter',
      startingCount: 2,
      currentState: 'OFF',
    });

    const startButton = screen.getByLabelText('Start') as HTMLButtonElement;
    expect(startButton.disabled).toBe(true);

    fireEvent.click(startButton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('disables FINISH when finishCount is at the max of 2', () => {
    const { onSelect } = renderPicker({
      boardName: 'kilter',
      finishCount: 2,
      currentState: 'OFF',
    });

    const finishButton = screen.getByLabelText('Finish') as HTMLButtonElement;
    expect(finishButton.disabled).toBe(true);

    fireEvent.click(finishButton);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('keeps STARTING enabled when this hold is already STARTING and at the cap', () => {
    // The user is editing a hold that already counts toward the cap; allowing
    // re-selection lets them confirm the same state without surprising no-ops.
    const { onSelect } = renderPicker({
      boardName: 'kilter',
      startingCount: 2,
      currentState: 'STARTING',
    });

    const startButton = screen.getByLabelText('Start') as HTMLButtonElement;
    expect(startButton.disabled).toBe(false);

    fireEvent.click(startButton);
    expect(onSelect).toHaveBeenCalledWith('STARTING');
  });

  it('marks the active swatch with aria-pressed', () => {
    renderPicker({ boardName: 'kilter', currentState: 'FINISH' });

    expect(screen.getByLabelText('Finish').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByLabelText('Start').getAttribute('aria-pressed')).toBe('false');
  });

  it('keeps FOOT enabled even when starting/finish are capped', () => {
    const { onSelect } = renderPicker({
      boardName: 'kilter',
      startingCount: 2,
      finishCount: 2,
    });

    const footButton = screen.getByLabelText('Foot') as HTMLButtonElement;
    expect(footButton.disabled).toBe(false);

    fireEvent.click(footButton);
    expect(onSelect).toHaveBeenCalledWith('FOOT');
  });
});
