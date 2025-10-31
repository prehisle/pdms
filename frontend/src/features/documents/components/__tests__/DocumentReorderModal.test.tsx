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

  it('should call onConfirm with current IDs when confirmed', async () => {
    const onConfirm = vi.fn();
    render(<DocumentReorderModal {...defaultProps} onConfirm={onConfirm} />);

    const confirmButton = await screen.findByRole('button', { name: /确认调整/ });
    fireEvent.click(confirmButton);

    expect(onConfirm).toHaveBeenCalledWith([1, 2, 3]);
  });

  it('should call onCancel when cancelled', async () => {
    const onCancel = vi.fn();
    render(<DocumentReorderModal {...defaultProps} onCancel={onCancel} />);

    const cancelButton = await screen.findByRole('button', { name: /取\s*消/ });
    fireEvent.click(cancelButton);

    expect(onCancel).toHaveBeenCalled();
  });

  it('should not render when modal is closed', () => {
    render(<DocumentReorderModal {...defaultProps} open={false} />);

    expect(screen.queryByText('调整文档排序')).not.toBeInTheDocument();
  });

  it('should show loading state', async () => {
    render(<DocumentReorderModal {...defaultProps} loading={true} />);

    const confirmButton = await screen.findByRole('button', { name: /确认调整/ });
    expect(confirmButton).toHaveClass('ant-btn-loading');
  });
});
