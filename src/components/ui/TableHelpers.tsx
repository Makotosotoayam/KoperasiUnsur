interface PaginationProps {
    currentPage: number;
    lastPage: number;
    total: number;
    onPageChange: (page: number) => void;
}

export function Pagination({ currentPage, lastPage, total, onPageChange }: PaginationProps) {
    if (lastPage <= 1) return null;

    return (
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <p className="text-sm text-gray-500">Total {total} data</p>
            <div className="flex gap-2">
                <button
                    type="button"
                    disabled={currentPage <= 1}
                    onClick={() => onPageChange(currentPage - 1)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white"
                >
                    Sebelumnya
                </button>
                <span className="px-3 py-1 text-sm text-gray-600">
                    {currentPage} / {lastPage}
                </span>
                <button
                    type="button"
                    disabled={currentPage >= lastPage}
                    onClick={() => onPageChange(currentPage + 1)}
                    className="px-3 py-1 text-sm border border-gray-300 rounded-lg disabled:opacity-40 hover:bg-white"
                >
                    Selanjutnya
                </button>
            </div>
        </div>
    );
}

export function LoadingState() {
    return (
        <div className="p-12 text-center text-gray-500">
            Memuat data...
        </div>
    );
}

export function EmptyState({ message }: { message: string }) {
    return (
        <div className="p-12 text-center text-gray-400">
            {message}
        </div>
    );
}

export function ErrorState({ message }: { message: string }) {
    return (
        <div className="p-12 text-center text-red-500">
            {message}
        </div>
    );
}

interface ActionButtonsProps {
    onEdit: () => void;
    onDelete: () => void;
}

export function ActionButtons({ onEdit, onDelete }: ActionButtonsProps) {
    return (
        <div className="flex gap-2 justify-end">
            <button type="button" onClick={onEdit} className="text-sm text-emerald-600 hover:text-emerald-800 font-medium">
                Edit
            </button>
            <button type="button" onClick={onDelete} className="text-sm text-red-600 hover:text-red-800 font-medium">
                Hapus
            </button>
        </div>
    );
}
