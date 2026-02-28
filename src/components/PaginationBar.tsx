import { ChevronLeft, ChevronRight } from 'lucide-react'
import './PaginationBar.css'

interface PaginationBarProps {
  currentPage: number
  totalPages: number
  totalCount: number
  perPage: number
  pageStart: number
  pageEnd: number
  onPrev: () => void
  onNext: () => void
}

export default function PaginationBar({
  currentPage,
  totalPages,
  totalCount,
  perPage,
  pageStart,
  pageEnd,
  onPrev,
  onNext
}: PaginationBarProps) {
  if (totalCount <= perPage) return null

  return (
    <div className="pagination-bar">
      <span className="pagination-bar-info">
        Показано {totalCount === 0 ? 0 : pageStart + 1}–{pageEnd} з {totalCount}
      </span>
      <div className="pagination-bar-controls">
        <button
          type="button"
          className="pagination-bar-btn"
          onClick={onPrev}
          disabled={currentPage <= 1}
          aria-label="Попередня сторінка"
        >
          <ChevronLeft size={20} />
        </button>
        <span className="pagination-bar-page">
          Сторінка {currentPage} з {totalPages}
        </span>
        <button
          type="button"
          className="pagination-bar-btn"
          onClick={onNext}
          disabled={currentPage >= totalPages}
          aria-label="Наступна сторінка"
        >
          <ChevronRight size={20} />
        </button>
      </div>
    </div>
  )
}
