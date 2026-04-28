import { describe, it, expect, vi, beforeEach } from 'vite-plus/test';
import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { BoardConfigMismatchDialog } from '../board-config-mismatch-dialog';
import type { BoardDetails } from '@/app/lib/types';
import type { ResolvedBoardConfig } from '@/app/lib/ble/board-config-match';

function makeBoardDetails(overrides: Partial<BoardDetails> = {}): BoardDetails {
  return {
    board_name: 'kilter',
    layout_id: 1,
    size_id: 10,
    set_ids: [1, 20],
    images_to_holds: {} as BoardDetails['images_to_holds'],
    holdsData: {} as BoardDetails['holdsData'],
    edge_left: 0,
    edge_right: 0,
    edge_bottom: 0,
    edge_top: 0,
    boardHeight: 0,
    boardWidth: 0,
    ...overrides,
  };
}

function makeConfig(overrides: Partial<ResolvedBoardConfig> = {}): ResolvedBoardConfig {
  return {
    boardName: 'kilter',
    layoutId: 99,
    sizeId: 10,
    setIds: '1,20',
    boardSlug: 'recorded-kilter',
    ...overrides,
  };
}

describe('BoardConfigMismatchDialog', () => {
  let onSwitch: ReturnType<typeof vi.fn<() => void>>;
  let onConnectAnyway: ReturnType<typeof vi.fn<() => void>>;
  let onCancel: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    onSwitch = vi.fn<() => void>();
    onConnectAnyway = vi.fn<() => void>();
    onCancel = vi.fn<() => void>();
  });

  function renderDialog(open = true) {
    return render(
      <BoardConfigMismatchDialog
        open={open}
        currentBoardDetails={makeBoardDetails()}
        recordedConfig={makeConfig()}
        onSwitch={onSwitch}
        onConnectAnyway={onConnectAnyway}
        onCancel={onCancel}
      />,
    );
  }

  it('does not render when open=false', () => {
    renderDialog(false);
    expect(screen.queryByText(/Board configuration doesn't match/i)).toBeNull();
  });

  it('renders the warning copy and the two config descriptions', () => {
    renderDialog();
    expect(screen.queryByText(/Board configuration doesn't match/i)).not.toBeNull();
    expect(screen.queryByText(/different config than you have configured/i)).not.toBeNull();
    expect(screen.queryByText(/You're configured for:/i)).not.toBeNull();
    expect(screen.queryByText(/Recorded for this controller:/i)).not.toBeNull();
  });

  it('Cancel calls onCancel and not the others', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /^Cancel$/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSwitch).not.toHaveBeenCalled();
    expect(onConnectAnyway).not.toHaveBeenCalled();
  });

  it('Connect anyway calls onConnectAnyway and not the others', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Connect anyway/i }));
    expect(onConnectAnyway).toHaveBeenCalledTimes(1);
    expect(onSwitch).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('Switch to correct config calls onSwitch and not the others', () => {
    renderDialog();
    fireEvent.click(screen.getByRole('button', { name: /Switch to correct config/i }));
    expect(onSwitch).toHaveBeenCalledTimes(1);
    expect(onConnectAnyway).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('renders fallback labels when getBoardDetails throws (unknown layout/size)', () => {
    render(
      <BoardConfigMismatchDialog
        open
        currentBoardDetails={makeBoardDetails({ layout_id: 99999, size_id: 99999, set_ids: [99999] })}
        recordedConfig={makeConfig({ layoutId: 88888, sizeId: 88888, setIds: '88888' })}
        onSwitch={onSwitch}
        onConnectAnyway={onConnectAnyway}
        onCancel={onCancel}
      />,
    );
    expect(screen.queryByText(/kilter 99999\/99999/)).not.toBeNull();
    expect(screen.queryByText(/kilter 88888\/88888/)).not.toBeNull();
  });
});
