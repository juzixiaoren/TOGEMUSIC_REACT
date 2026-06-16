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

    const btnClass = "border border-border-blue-page bg-surface-elevated rounded-lg px-3 py-1.5 cursor-pointer text-text-blue-muted text-xs transition-all duration-200 hover:border-primary hover:text-primary disabled:opacity-50 disabled:cursor-not-allowed";
    const pageBaseClass = "w-8 h-8 border rounded-lg cursor-pointer text-xs flex items-center justify-center transition-all duration-200";
    const pageNormalClass = "border-border-blue-page bg-surface-elevated text-text-blue-muted hover:border-primary hover:text-primary";
    const pageActiveClass = "border-transparent text-white bg-primary";

    return (
        <div className="flex items-center justify-center gap-2 py-3 flex-shrink-0">
            <button
                className={btnClass}
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage <= 1}
            >
                上一页
            </button>
            <div className="flex items-center gap-1">
                {getPageNumbers().map((page, index) => (
                    typeof page === 'number' ? (
                        <button
                            key={index}
                            className={`${pageBaseClass} ${currentPage === page ? pageActiveClass : pageNormalClass}`}
                            onClick={() => onPageChange(page)}
                        >
                            {page}
                        </button>
                    ) : (
                        <span key={index} className="w-8 text-center text-text-blue-sub">...</span>
                    )
                ))}
            </div>
            <button
                className={btnClass}
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage >= totalPages}
            >
                下一页
            </button>
        </div>
    );
}
