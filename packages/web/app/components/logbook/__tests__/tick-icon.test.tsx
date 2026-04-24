import { describe, it, expect } from 'vite-plus/test';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TickIcon, TickButtonWithLabel } from '../tick-icon';

describe('TickIcon', () => {
  it('renders ElectricBoltOutlined when isFlash is true', () => {
    const { container } = render(<TickIcon isFlash />);
    // MUI icons render as SVG with a data-testid attribute on the path
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    // ElectricBoltOutlined has a specific class name pattern
    expect(svg?.getAttribute('data-testid')).toBe('ElectricBoltOutlinedIcon');
  });

  it('renders CheckOutlined when isFlash is false', () => {
    const { container } = render(<TickIcon isFlash={false} />);
    const svg = container.querySelector('svg');
    expect(svg).toBeTruthy();
    expect(svg?.getAttribute('data-testid')).toBe('CheckOutlinedIcon');
  });
});

describe('TickButtonWithLabel', () => {
  it('renders the child element', () => {
    render(
      <TickButtonWithLabel label="tick">
        <button data-testid="child-btn">Save</button>
      </TickButtonWithLabel>,
    );
    expect(screen.getByTestId('child-btn')).toBeTruthy();
  });

  it('renders "tick" label', () => {
    render(
      <TickButtonWithLabel label="tick">
        <button>Save</button>
      </TickButtonWithLabel>,
    );
    expect(screen.getByText('tick')).toBeTruthy();
  });

  it('renders "flash" label', () => {
    render(
      <TickButtonWithLabel label="flash">
        <button>Save</button>
      </TickButtonWithLabel>,
    );
    expect(screen.getByText('flash')).toBeTruthy();
  });

  it('renders "attempt" label', () => {
    render(
      <TickButtonWithLabel label="attempt">
        <button>Save</button>
      </TickButtonWithLabel>,
    );
    expect(screen.getByText('attempt')).toBeTruthy();
  });

  it('wraps the child in a positioned container', () => {
    render(
      <TickButtonWithLabel label="tick">
        <button data-testid="child-btn">Save</button>
      </TickButtonWithLabel>,
    );
    const btn = screen.getByTestId('child-btn');
    // The wrapper should be the parent of the button
    const wrapper = btn.parentElement;
    expect(wrapper).toBeTruthy();
    // The label span should be a sibling of the button
    const label = wrapper?.querySelector('span');
    expect(label?.textContent).toBe('tick');
  });
});
