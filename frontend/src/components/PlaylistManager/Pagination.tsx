import './Pagination.css';

interface PaginationProps {
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
}

export default function Pagination({ currentPage, totalPages, onPageChange }: PaginationProps) {
    if (totalPages <= 1) return null;

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        const showEllipsisStart = currentPage > 3;
        const showEllipsisEnd = currentPage < totalPages - 2;

        if (totalPages <= 7) {
            for (let i = 1; i <= totalPages; i++) {
                pages.push(i);
            }
        } else {
            pages.push(1);

            if (showEllipsisStart) {
                pages.push('...');
            }

            const start = Math.max(2, currentPage - 1);
            const end = Math.min(totalPages - 1, currentPage + 1);

            for (let i = start; i <= end; i++) {
                if (!pages.includes(i)) {
                    pages.push(i);
                }
            }

            if (showEllipsisEnd) {
                pages.push('...');
            }

            if (!pages.includes(totalPages)) {
                pages.push(totalPages);
            }
        }

        return pages;
    };

    return (
        <div className="pagination">
            <button
                className="pagination-btn"
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
            >
                上一页
            </button>
            <div className="pagination-pages">
                {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                        <button
                            key={index}
                            className={`pagination-page ${currentPage === page ? 'active' : ''}`}
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </button>
                    ) : (
                        <span key={index} className="pagination-ellipsis">...</span>
                    )
                ))}
            </div>
            <button
                className="pagination-btn"
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
            >
                下一页
            </button>
        </div>
    );
}
