import { render, screen, fireEvent } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { DocumentReorderModal } from '../DocumentReorderModal';
import type { Document } from '../../../../api/documents';

const mockDocuments: Document[] = [
  {
    id: 1,
    title: 'Document A',
    type: 'overview',
    position: 1,
    created_by: 'user1',
    updated_by: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
  },
  {
    id: 2,
    title: 'Document B',
    type: 'dictation',
    position: 2,
    created_by: 'user1',
    updated_by: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
  },
  {
    id: 3,
    title: 'Document C',
    type: 'overview',
    position: 3,
    created_by: 'user1',
    updated_by: 'user1',
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
    metadata: {},
  },
];

describe('DocumentReorderModal', () => {
  const defaultProps = {
    open: true,
    documents: mockDocuments,
    loading: false,
    onCancel: vi.fn(),
    onConfirm: vi.fn(),
  };

  it('should render the modal with documents', () => {
    render(<DocumentReorderModal {...defaultProps} />);

    expect(screen.getByText('调整文档排序')).toBeInTheDocument();
    expect(screen.getByText('Document A')).toBeInTheDocument();
    expect(screen.getByText('Document B')).toBeInTheDocument();
    expect(screen.getByText('Document C')).toBeInTheDocument();
  });

  it('should show documents sorted by position initially', () => {
    render(<DocumentReorderModal {...defaultProps} />);

    const rows = screen.getAllByRole('row');
    // Skip header row
    expect(rows[1]).toHaveTextContent('Document A');
    expect(rows[2]).toHaveTextContent('Document B');
    expect(rows[3]).toHaveTextContent('Document C');
  });

  it('should disable up button for first item and down button for last item', () => {
    render(<DocumentReorderModal {...defaultProps} />);

    const upButtons = screen.getAllByTitle('上移');
    const downButtons = screen.getAllByTitle('下移');

    // First item's up button should be disabled
    expect(upButtons[0]).toBeDisabled();

    // Last item's down button should be disabled
    expect(downButtons[downButtons.length - 1]).toBeDisabled();
  });

  it('should call onConfirm with reordered IDs when confirmed', () => {
    const onConfirm = vi.fn();
    render(<DocumentReorderModal {...defaultProps} onConfirm={onConfirm} />);

    // Move second item down
    const downButtons = screen.getAllByTitle('下移');
    fireEvent.click(downButtons[0]);

    // Click confirm
    fireEvent.click(screen.getByText('确认调整'));

    // Should be called with the new order (B moved down, so: A, C, B)
    expect(onConfirm).toHaveBeenCalledWith([1, 3, 2]);
  });

  it('should call onCancel when cancelled', () => {
    const onCancel = vi.fn();
    render(<DocumentReorderModal {...defaultProps} onCancel={onCancel} />);

    fireEvent.click(screen.getByText('取消'));

    expect(onCancel).toHaveBeenCalled();
  });

  it('should not render when modal is closed', () => {
    render(<DocumentReorderModal {...defaultProps} open={false} />);

    expect(screen.queryByText('调整文档排序')).not.toBeInTheDocument();
  });

  it('should show loading state', () => {
    render(<DocumentReorderModal {...defaultProps} loading={true} />);

    const confirmButton = screen.getByText('确认调整');
    expect(confirmButton).toBeDisabled();
  });
});