import { describe, it, expect, vi } from 'vite-plus/test';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { DevicePickerDialog } from '../device-picker-dialog';
import type { DiscoveredDevice } from '@/app/lib/ble/types';
import React from 'react';
import { tFromCatalog } from '@/app/__test-helpers__/i18n-mock';

vi.mock('react-i18next', () => ({
  useTranslation: (ns?: string) => ({
    t: (key: string, options?: Record<string, unknown>) => tFromCatalog(ns, key, options),
    i18n: { language: 'en-US' },
  }),
  Trans: ({ children }: { children?: React.ReactNode }) => children ?? null,
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}));

function makeDevice(overrides: Partial<DiscoveredDevice> & { deviceId: string; rssi: number }): DiscoveredDevice {
  return { ...overrides };
}

describe('DevicePickerDialog', () => {
  const defaultProps = {
    devices: [] as DiscoveredDevice[],
    onSelect: vi.fn(),
    onCancel: vi.fn(),
  };

  describe('scanning state', () => {
    it('shows scanning text when devices list is empty', () => {
      render(<DevicePickerDialog {...defaultProps} devices={[]} />);

      expect(screen.getByText(/Scanning for boards nearby/)).toBeTruthy();
    });

    it('shows a loading spinner when devices list is empty', () => {
      render(<DevicePickerDialog {...defaultProps} devices={[]} />);

      expect(screen.getByRole('progressbar')).toBeTruthy();
    });
  });

  describe('device list rendering', () => {
    it('renders device names when devices are provided', () => {
      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'dev-1', name: 'Kilter Board A', rssi: -60 }),
        makeDevice({ deviceId: 'dev-2', name: 'Tension Board B', rssi: -45 }),
      ];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Kilter Board A')).toBeTruthy();
      expect(screen.getByText('Tension Board B')).toBeTruthy();
    });

    it('does not show scanning text when devices are present', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'dev-1', name: 'Board', rssi: -60 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.queryByText(/Scanning for boards nearby/)).toBeNull();
      expect(screen.queryByRole('progressbar')).toBeNull();
    });
  });

  describe('unknown device fallback', () => {
    it('shows "Unknown device" when a device has no name', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'dev-no-name', rssi: -70 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Unknown device')).toBeTruthy();
    });

    it('shows "Unknown device" when name is an empty string', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'dev-empty-name', name: '', rssi: -70 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Unknown device')).toBeTruthy();
    });
  });

  describe('signal strength labels', () => {
    it('shows "Strong" for rssi >= -50', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'strong', name: 'Strong Board', rssi: -50 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Strong')).toBeTruthy();
    });

    it('shows "Strong" for rssi better than -50', () => {
      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'very-strong', name: 'Very Strong Board', rssi: -30 }),
      ];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Strong')).toBeTruthy();
    });

    it('shows "Good" for rssi >= -70 and < -50', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'good', name: 'Good Board', rssi: -60 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Good')).toBeTruthy();
    });

    it('shows "Good" for rssi exactly -70', () => {
      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'good-boundary', name: 'Good Boundary Board', rssi: -70 }),
      ];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Good')).toBeTruthy();
    });

    it('shows "Weak" for rssi >= -85 and < -70', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'weak', name: 'Weak Board', rssi: -75 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Weak')).toBeTruthy();
    });

    it('shows "Weak" for rssi exactly -85', () => {
      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'weak-boundary', name: 'Weak Boundary Board', rssi: -85 }),
      ];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Weak')).toBeTruthy();
    });

    it('shows "Very weak" for rssi < -85', () => {
      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'very-weak', name: 'Very Weak Board', rssi: -90 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(screen.getByText('Very weak')).toBeTruthy();
    });
  });

  describe('sorting by signal strength', () => {
    it('sorts devices strongest-first in the rendered list', () => {
      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'weak', name: 'Weak Board', rssi: -80 }),
        makeDevice({ deviceId: 'strong', name: 'Strong Board', rssi: -40 }),
        makeDevice({ deviceId: 'medium', name: 'Medium Board', rssi: -60 }),
      ];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      const listItems = screen.getAllByRole('button', { name: /Board/ });
      // Filter out the Cancel button - only keep list item buttons (MUI ListItemButton uses div)
      const deviceButtons = listItems.filter((item) => item.tagName !== 'BUTTON');

      expect(deviceButtons).toHaveLength(3);
      expect(within(deviceButtons[0]).getByText('Strong Board')).toBeTruthy();
      expect(within(deviceButtons[1]).getByText('Medium Board')).toBeTruthy();
      expect(within(deviceButtons[2]).getByText('Weak Board')).toBeTruthy();
    });

    it('does not mutate the original devices array', () => {
      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'b', name: 'B', rssi: -80 }),
        makeDevice({ deviceId: 'a', name: 'A', rssi: -40 }),
      ];

      const originalOrder = [...devices];

      render(<DevicePickerDialog {...defaultProps} devices={devices} />);

      expect(devices[0].deviceId).toBe(originalOrder[0].deviceId);
      expect(devices[1].deviceId).toBe(originalOrder[1].deviceId);
    });
  });

  describe('device selection', () => {
    it('calls onSelect with the correct deviceId when a device is clicked', () => {
      const onSelect = vi.fn();

      const devices: DiscoveredDevice[] = [
        makeDevice({ deviceId: 'kilter-123', name: 'Kilter Board', rssi: -55 }),
        makeDevice({ deviceId: 'tension-456', name: 'Tension Board', rssi: -65 }),
      ];

      render(<DevicePickerDialog {...defaultProps} devices={devices} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('Tension Board'));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith('tension-456');
    });

    it('calls onSelect with correct id when clicking the first device', () => {
      const onSelect = vi.fn();

      const devices: DiscoveredDevice[] = [makeDevice({ deviceId: 'first-dev', name: 'First Device', rssi: -50 })];

      render(<DevicePickerDialog {...defaultProps} devices={devices} onSelect={onSelect} />);

      fireEvent.click(screen.getByText('First Device'));

      expect(onSelect).toHaveBeenCalledWith('first-dev');
    });
  });

  describe('cancel', () => {
    it('calls onCancel when the Cancel button is clicked', () => {
      const onCancel = vi.fn();

      render(<DevicePickerDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('dialog close', () => {
    it('calls onCancel when Escape key is pressed', () => {
      const onCancel = vi.fn();

      render(<DevicePickerDialog {...defaultProps} onCancel={onCancel} />);

      fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(onCancel).toHaveBeenCalledTimes(1);
    });

    it('calls onCancel when clicking the backdrop', () => {
      const onCancel = vi.fn();

      render(<DevicePickerDialog {...defaultProps} onCancel={onCancel} />);

      // MUI Dialog renders a backdrop as part of its structure.
      // Clicking the backdrop triggers onClose, which maps to onCancel.
      const backdrop = document.querySelector('.MuiBackdrop-root');
      expect(backdrop).not.toBeNull();

      fireEvent.click(backdrop as Element);

      expect(onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('dialog title', () => {
    it('shows "Select your board" as the dialog title', () => {
      render(<DevicePickerDialog {...defaultProps} />);

      expect(screen.getByText('Select your board')).toBeTruthy();
    });
  });
});
