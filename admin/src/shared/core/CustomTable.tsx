import { AnimatePresence, motion } from '@/shared/utils/motion';
import * as lodash from 'lodash';
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Download,
  RotateCw,
  Search,
  SortAsc,
  SortDesc,
  TableProperties,
} from 'lucide-react';
import React, {
  CSSProperties,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from 'react';

// Helper function to update URL query parameters
const updateQueryParams = (params: Record<string, string | number>) => {
  if (typeof window === 'undefined') {
    return;
  }

  const url = new URL(window.location.href);
  const searchParams = new URLSearchParams(url.search);

  Object.entries(params).forEach(([key, value]) => {
    searchParams.set(key, String(value));
  });

  const newUrl = `${url.pathname}?${searchParams.toString()}`;
  window.history.pushState({}, '', newUrl);
};

// Base types and interfaces
export type RecordId = string | number;
export type RowIdentifier = string | number;
export interface RecordWithId {
  id?: RecordId;
  [key: string]: unknown;
}

export type Field<T> = keyof T;

export interface ExpandableConfig {
  enabled: boolean;
  maxLines?: number;
  maxCharacters?: number;
  showMoreText?: string;
  showLessText?: string;
}

export interface Column<T> {
  field: Field<T>;
  title: string;
  width?: string;
  minWidth?: string;
  maxWidth?: string;
  headerClassName?: string;
  cellClassName?: string;
  render?: (row: T) => React.ReactNode;
  sortable?: boolean;
  filterable?: boolean;
  hidden?: boolean;
  expandable?: ExpandableConfig;
  sticky?: 'left' | 'right'; // Make column sticky on left or right side
}

export interface Action<T> {
  icon?: React.ReactNode | ((row: T) => React.ReactNode);
  tooltip?: string;
  onClick: (row: T) => void;
  className?: string | ((row: T) => string);
  hidden?: (row: T) => boolean;
}

export interface TableThemeColors {
  headerBg?: string;
  headerText?: string;
  headerBorder?: string;
  headerHover?: string;
  sortIconColor?: string;
}

export interface TableOptions {
  toolbar?: boolean;
  search?: boolean;
  filtering?: boolean;
  sorting?: boolean;
  selection?: boolean;
  export?: boolean;
  refresh?: boolean;
  pagination?: boolean;
  detailPanel?: boolean;
  detailPanelPosition?: 'left' | 'right';
  detailPanelHeader?: string;
  tableColor?: string;
  padding?: 'normal' | 'compact' | 'wide';
  pageSize?: number;
  pageSizeOptions?: number[];
  responsive?: boolean;
  stickyHeader?: boolean;
  verticalScroll?: boolean;
  maxHeight?: string;
  theme?: TableThemeColors;
  containerHeight?: string;
  fixedHeight?: boolean;
  bordered?: boolean;
}

export interface Localization {
  toolbar?: {
    searchPlaceholder?: string;
    exportTitle?: string;
    exportCSV?: string;
    exportPDF?: string;
  };
  pagination?: {
    labelRowsSelect?: string;
    labelDisplayedRows?: string;
  };
  header?: {
    actions?: string;
  };
  body?: {
    emptyDataSourceMessage?: string;
    filterRow?: {
      filterPlaceholder?: string;
    };
  };
}

interface ContainerProps {
  children: React.ReactNode;
  className?: string;
  options?: TableOptions;
}

export interface ToolbarProps {
  title?: string | undefined;
  subtitle?: string | undefined;
  description?: string | undefined;
  onSearch?: (value: string) => void;
  onExport?: (type: 'csv' | 'pdf') => void;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isValidating?: boolean;
  searchValue?: string;
  className?: string;
  showSearch?: boolean;
  showExport?: boolean;
  showRefresh?: boolean;
}

export interface PaginationProps {
  count: number;
  page: number;
  rowsPerPage: number;
  onPageChange: (page: number) => void;
  onRowsPerPageChange: (pageSize: number) => void;
  className?: string;
}

export interface TableComponents {
  container?: React.ComponentType<ContainerProps>;
  toolbar?: React.ComponentType<ToolbarProps>;
  pagination?: React.ComponentType<PaginationProps>;
  loadingOverlay?: React.ComponentType;
  emptyState?: React.ComponentType;
  customToolbar?: React.ComponentType<{ children: React.ReactNode }>;
  detailPanel?: React.ComponentType<{ row: RecordWithId }>;
}

// Ref interface for imperative methods
export interface CVTableRef {
  resetSelection: () => void;
}

export interface CVTableProps<T extends RecordWithId> {
  columns: Column<T>[];
  data: T[];
  title?: string;
  subtitle?: string;
  description?: string;
  onRefresh?: () => void;
  isRefreshing?: boolean;
  isValidating?: boolean;
  customToolbar?: React.ReactNode;
  isLoading?: boolean;
  page?: number;
  pageSize?: number;
  totalCount?: number;
  onPageChange?: (page: number) => void;
  onRowsPerPageChange?: (pageSize: number) => void;
  selection?: boolean;
  onSelectionChange?: (selected: T[]) => void;
  defaultOrderBy?: Field<T>;
  defaultOrderDirection?: 'asc' | 'desc';
  filtering?: boolean;
  actions?: Action<T>[];
  detailPanel?: ((row: T) => React.ReactNode) | React.ReactNode;
  components?: TableComponents;
  options?: TableOptions;
  localization?: Localization;
  className?: string;
  containerClassName?: string;
  getRowClassName?: (row: T) => string;
  onRowClick?: (row: T) => void;
  queryPaginationEnabled?: boolean;
}

// Default options
const defaultOptions: TableOptions = {
  toolbar: true,
  search: true,
  filtering: false,
  sorting: true,
  selection: false,
  export: true,
  pagination: true,
  detailPanel: false,
  detailPanelPosition: 'left',
  detailPanelHeader: 'Details',
  tableColor: 'bg-primary/80',
  padding: 'normal',
  pageSize: 10,
  pageSizeOptions: [5, 10, 25, 50],
  responsive: true,
  stickyHeader: false,
  verticalScroll: true,
  containerHeight: '400px',
  fixedHeight: false,
  bordered: true,
  theme: {
    headerBg: 'bg-slate-50/80',
    headerText: 'text-slate-500',
    headerBorder: 'border-slate-100',
    headerHover: 'hover:bg-slate-100/80',
    sortIconColor: 'text-primary',
  },
};

// Localization
const defaultLocalization: Localization = {
  toolbar: {
    searchPlaceholder: 'Search',
    exportTitle: 'Export',
    exportCSV: 'Export as CSV',
    exportPDF: 'Export as PDF',
  },
  pagination: {
    labelRowsSelect: 'rows',
    labelDisplayedRows: '{from}-{to} of {count}',
  },
  header: {
    actions: 'Actions',
  },
  body: {
    emptyDataSourceMessage: 'No records to display',
    filterRow: {
      filterPlaceholder: 'Filter',
    },
  },
};

// Helper function to get unique identifier
const getRowIdentifier = <T extends Record<string, unknown>>(
  row: T,
  index: number,
): RowIdentifier => {
  const idFields = ['id', 'ID', '_id', 'uid', 'key'] as const;
  for (const field of idFields) {
    const value = row[field];
    if (
      value !== undefined &&
      value !== null &&
      (typeof value === 'string' || typeof value === 'number')
    ) {
      return value as RowIdentifier;
    }
  }
  return `${Object.values(row)
    .map((val) => (val !== undefined ? String(val) : ''))
    .join('_')}_${index}`;
};

// Selection hook
const useSelection = <T extends Record<string, unknown>>(
  _: T[],
  onSelectionChange?: (selected: T[]) => void,
) => {
  const [selected, setSelected] = useState<Map<RowIdentifier, T>>(new Map());
  const [expandedTextRows, setExpandedTextRows] = useState<Set<string>>(new Set());

  const isSelected = useCallback(
    (row: T, index: number) => selected.has(getRowIdentifier(row, index)),
    [selected],
  );

  const toggleTextExpansion = useCallback((rowId: string, field: string) => {
    setExpandedTextRows((prev) => {
      const newSet = new Set(prev);
      const key = `${rowId}-${field}`;
      if (newSet.has(key)) {
        newSet.delete(key);
      } else {
        // Close all other expanded rows
        const fieldKeys = Array.from(newSet).filter((k) => k.endsWith(`-${field}`));
        fieldKeys.forEach((k) => newSet.delete(k));
        newSet.add(key);
      }
      return newSet;
    });
  }, []);

  const isTextExpanded = useCallback(
    (rowId: string, field: string) => {
      return expandedTextRows.has(`${rowId}-${field}`);
    },
    [expandedTextRows],
  );

  const toggleSelection = useCallback(
    (row: T, index: number) => {
      setSelected((prev) => {
        const newMap = new Map(prev);
        const id = getRowIdentifier(row, index);
        if (newMap.has(id)) {
          newMap.delete(id);
        } else {
          newMap.set(id, row);
        }
        onSelectionChange?.(Array.from(newMap.values()));
        return newMap;
      });
    },
    [onSelectionChange],
  );

  const toggleAll = useCallback(
    (rows: T[]) => {
      setSelected((prev) => {
        const newMap = new Map(prev);
        const allSelected = rows.every((row, idx) => newMap.has(getRowIdentifier(row, idx)));
        if (allSelected) {
          rows.forEach((row, idx) => newMap.delete(getRowIdentifier(row, idx)));
        } else {
          rows.forEach((row, idx) => newMap.set(getRowIdentifier(row, idx), row));
        }
        onSelectionChange?.(Array.from(newMap.values()));
        return newMap;
      });
    },
    [onSelectionChange],
  );

  const isAllSelected = useCallback(
    (rows: T[]) =>
      rows.length > 0 && rows.every((row, idx) => selected.has(getRowIdentifier(row, idx))),
    [selected],
  );

  const clearSelection = useCallback(() => {
    setSelected(new Map());
    onSelectionChange?.([]);
  }, [onSelectionChange]);

  return {
    selected,
    isSelected,
    toggleSelection,
    toggleAll,
    isAllSelected,
    clearSelection,
    expandedTextRows,
    toggleTextExpansion,
    isTextExpanded,
  };
};

// Memoized components
const DefaultContainer = React.memo<ContainerProps>(({ children, className = '', options }) => {
  const containerStyle: CSSProperties | undefined = options?.fixedHeight
    ? {
        height: options.containerHeight || '400px',
        display: 'flex',
        flexDirection: 'column',
      }
    : undefined;

  return (
    <div
      className={`flex flex-col overflow-hidden rounded-2xl bg-white ${className}`}
      style={containerStyle}
    >
      {children}
    </div>
  );
});
DefaultContainer.displayName = 'DefaultContainer';

const DefaultToolbar = React.memo<ToolbarProps>(
  ({
    title,
    subtitle,
    description,
    onSearch,
    onExport,
    onRefresh,
    isRefreshing = false,
    isValidating = false,
    searchValue,
    className = '',
    showSearch = true,
    showExport = true,
    showRefresh = false,
  }) => {
    const sub = subtitle || description;
    const refreshing = isRefreshing || isValidating;

    return (
      <div className={`bg-white px-4 py-4 sm:px-5 border-b border-slate-100 ${className}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-4">
            {(title || sub) && (
              <div className="flex flex-col">
                {title && <h2 className="text-xl font-bold text-slate-900">{title}</h2>}
                {sub && <p className="mt-0.5 text-xs font-normal text-slate-500">{sub}</p>}
              </div>
            )}
            {showSearch && (
              <div className="relative w-full sm:w-64 md:w-80">
                <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  value={searchValue}
                  placeholder="Search records..."
                  aria-label="Search table records"
                  className="w-full rounded-2xl bg-slate-50 py-2.5 pl-10 pr-4 text-sm text-slate-800 outline-none transition focus:bg-primary-50 focus:ring-2 focus:ring-primary/15"
                  onChange={(e) => onSearch?.(e.target.value)}
                />
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            {(showRefresh || Boolean(onRefresh)) && (
              <button
                type="button"
                onClick={() => onRefresh?.()}
                disabled={refreshing}
                className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-primary-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:opacity-75 disabled:cursor-not-allowed"
                aria-label="Refresh data"
              >
                <RotateCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-primary' : ''}`} />
                <span>{refreshing ? 'Refreshing...' : 'Refresh'}</span>
              </button>
            )}
            {showExport && (
              <button
                type="button"
                onClick={() => onExport?.('csv')}
                className="inline-flex items-center justify-center gap-2 cursor-pointer rounded-xl bg-slate-100 px-3.5 py-2.5 text-xs font-semibold text-slate-600 transition hover:bg-primary-50 hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                aria-label="Export table as CSV"
              >
                <Download className="h-4 w-4" />
                <span>Export CSV</span>
              </button>
            )}
          </div>
        </div>
      </div>
    );
  },
);
DefaultToolbar.displayName = 'DefaultToolbar';

const CustomToolbarSection = React.memo<{ children: React.ReactNode }>(({ children }) => (
  <div className="h-fit w-full">{children}</div>
));
CustomToolbarSection.displayName = 'CustomToolbarSection';

const CustomPagination = React.memo<PaginationProps>(
  ({ count, page, rowsPerPage, onPageChange, onRowsPerPageChange, className = '' }) => {
    const totalPages = Math.max(1, Math.ceil(count / rowsPerPage));

    const getPageNumbers = useCallback(() => {
      const delta = 2;
      const range: number[] = [];
      const rangeWithDots: (number | string)[] = [];
      let l: number | undefined;

      for (let i = 1; i <= totalPages; i++) {
        if (i === 1 || i === totalPages || (i >= page - delta && i <= page + delta)) {
          range.push(i);
        }
      }

      range.sort((a, b) => a - b);

      for (const i of range) {
        if (l) {
          if (i - l === 2) {
            rangeWithDots.push(l + 1);
          } else if (i - l !== 1) {
            rangeWithDots.push('...');
          }
        }
        rangeWithDots.push(i);
        l = i;
      }

      return rangeWithDots;
    }, [page, totalPages]);

    const pageNumbers = useMemo(() => getPageNumbers(), [getPageNumbers]);

    return (
      <div
        className={`mt-auto flex flex-col gap-3 bg-slate-50/70 px-4 py-3.5 sm:flex-row sm:items-center sm:justify-between sm:px-5 border-t border-slate-100 ${className}`}
      >
        <div className="flex items-center gap-2 text-xs font-medium text-slate-500">
          <span>Rows per page</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              onRowsPerPageChange(Number(e.target.value));
              onPageChange(0);
            }}
            aria-label="Rows per page"
            className="cursor-pointer rounded-xl bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-primary/20"
          >
            {[5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>

        <div className="order-first flex items-center justify-center gap-1 sm:order-none">
          <button
            onClick={() => onPageChange(Math.max(0, page - 1))}
            disabled={page === 0}
            aria-label="Previous page"
            className="rounded-xl bg-white p-2 text-slate-500 transition enabled:hover:bg-primary-50 enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>

          <div className="flex gap-1">
            {pageNumbers.map((num, index) => (
              <button
                key={index}
                onClick={() => (typeof num === 'number' ? onPageChange(num - 1) : undefined)}
                disabled={num === '...'}
                aria-label={typeof num === 'number' ? `Page ${num}` : undefined}
                className={`min-w-9 rounded-xl px-2.5 py-1.5 text-sm font-semibold transition ${
                  num === page + 1
                    ? 'bg-primary text-white'
                    : 'bg-white text-slate-600 enabled:hover:bg-primary-50 enabled:hover:text-primary'
                } ${num === '...' ? 'cursor-default' : ''}`}
              >
                {num}
              </button>
            ))}
          </div>

          <button
            onClick={() => onPageChange(Math.min(totalPages - 1, page + 1))}
            disabled={page >= totalPages - 1}
            aria-label="Next page"
            className="rounded-xl bg-white p-2 text-slate-500 transition enabled:hover:bg-primary-50 enabled:hover:text-primary disabled:cursor-not-allowed disabled:opacity-35"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="text-center text-xs font-medium text-slate-500 sm:text-right">
          {count > 0
            ? `${page * rowsPerPage + 1}-${Math.min((page + 1) * rowsPerPage, count)} of ${count}`
            : '0 of 0'}
        </div>
      </div>
    );
  },
);
CustomPagination.displayName = 'CustomPagination';

const DefaultLoadingOverlay = React.memo(() => (
  <div className="flex w-full flex-col items-center justify-center gap-3 py-16">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary/20 border-t-primary" />
    <p className="text-xs font-medium text-slate-400">Loading records...</p>
  </div>
));
DefaultLoadingOverlay.displayName = 'DefaultLoadingOverlay';

const DefaultEmptyState = React.memo(() => (
  <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
    <div className="flex size-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400">
      <TableProperties className="size-5" />
    </div>
    <p className="mt-3 text-sm font-semibold text-slate-700">
      {defaultLocalization.body?.emptyDataSourceMessage}
    </p>
    <p className="mt-1 text-xs text-slate-400">New records will appear here when available.</p>
  </div>
));
DefaultEmptyState.displayName = 'DefaultEmptyState';

const DefaultDetailPanel = React.memo<{ row: RecordWithId }>(({ row }) => (
  <div className="bg-gray-50 p-4">
    <pre className="text-sm text-gray-700">{JSON.stringify(row, null, 2)}</pre>
  </div>
));
DefaultDetailPanel.displayName = 'DefaultDetailPanel';

// Main component implementation with forwardRef
const CustomTable = forwardRef(
  <T extends Record<string, unknown>>(
    {
      columns,
      data = [],
      title,
      subtitle,
      description,
      onRefresh,
      isRefreshing,
      isValidating,
      customToolbar,
      isLoading = false,
      page = 0,
      pageSize,
      totalCount,
      onPageChange,
      onRowsPerPageChange,
      selection = false,
      onSelectionChange,
      defaultOrderBy,
      defaultOrderDirection = 'asc',
      filtering = false,
      actions = [],
      detailPanel,
      components = {},
      options: userOptions = {},
      localization: userLocalization = {},
      className = '',
      containerClassName = '',
      getRowClassName,
      onRowClick,
      queryPaginationEnabled = false,
    }: CVTableProps<T>,
    ref: React.Ref<CVTableRef>,
  ) => {
    // Memoized options and localization
    const options = useMemo(() => ({ ...defaultOptions, ...userOptions }), [userOptions]);
    const localization = useMemo(
      () => lodash.merge({}, defaultLocalization, userLocalization),
      [userLocalization],
    );

    // State management
    const [orderBy, setOrderBy] = useState<Field<T> | undefined>(defaultOrderBy);
    const [orderDirection, setOrderDirection] = useState<'asc' | 'desc'>(defaultOrderDirection);
    const [filters, setFilters] = useState<Record<string, string>>({});
    const [searchText, setSearchText] = useState('');
    const [expandedRows, setExpandedRows] = useState<Set<RowIdentifier>>(new Set());
    const [visibleColumns] = useState<Record<string, boolean>>(() =>
      columns.reduce((acc, col) => ({ ...acc, [col.field as string]: !col.hidden }), {}),
    );

    // Sticky columns support
    const tableContainerRef = useRef<HTMLDivElement>(null);

    // Calculate sticky column positions
    const stickyColumnPositions = useMemo(() => {
      const positions = new Map<string, { left?: string; right?: string }>();
      let leftOffset = 0;
      let rightOffset = 0;

      // Calculate left sticky positions
      const leftStickyColumns = columns.filter((col) => col.sticky === 'left');
      for (const col of leftStickyColumns) {
        positions.set(col.field as string, { left: `${leftOffset}px` });
        leftOffset += parseInt(col.width || '150');
      }

      // Calculate right sticky positions
      const rightStickyColumns = columns.filter((col) => col.sticky === 'right').reverse();
      for (const col of rightStickyColumns) {
        positions.set(col.field as string, { right: `${rightOffset}px` });
        rightOffset += parseInt(col.width || '150');
      }

      return positions;
    }, [columns]);

    // Selection handling
    const {
      isSelected,
      toggleSelection,
      toggleAll,
      isAllSelected,
      clearSelection,
      toggleTextExpansion,
      isTextExpanded,
    } = useSelection(data, onSelectionChange);

    const [currentPage, setCurrentPage] = useState(page);
    const [currentPageSize, setCurrentPageSize] = useState<number>(() => {
      if (pageSize !== undefined) {
        return pageSize;
      }
      if (options.fixedHeight) {
        const rowHeight = options.padding === 'compact' ? 48 : options.padding === 'wide' ? 72 : 56;
        const availableHeight = parseInt(options.containerHeight || '400') - 176;
        return Math.max(1, Math.floor(availableHeight / rowHeight));
      }
      return options.pageSize ?? defaultOptions.pageSize ?? 10;
    });

    // Expose resetSelection method via ref
    useImperativeHandle(ref, () => ({
      resetSelection: () => {
        clearSelection();
      },
    }));

    // Event handlers
    const handleSearch = useCallback((value: string) => {
      setSearchText(value);
    }, []);

    const handlePageChange = useCallback(
      (newPage: number) => {
        setCurrentPage(newPage);
        if (queryPaginationEnabled) {
          updateQueryParams({ page: newPage });
        }
        onPageChange?.(newPage);
      },
      [onPageChange, queryPaginationEnabled],
    );

    const handleRowsPerPageChange = useCallback(
      (newPageSize: number) => {
        setCurrentPageSize(newPageSize);
        setCurrentPage(0);
        if (queryPaginationEnabled) {
          updateQueryParams({ page: 0, limit: newPageSize });
        }
        onRowsPerPageChange?.(newPageSize);
      },
      [onRowsPerPageChange, queryPaginationEnabled],
    );
    // Sync controlled props into state
    const effectivePage = page !== undefined ? page : currentPage;
    const effectivePageSize = pageSize !== undefined ? pageSize : currentPageSize;

    useEffect(() => {
      if (page !== undefined && page !== currentPage) {
        React.startTransition(() => setCurrentPage(page));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [page]);

    useEffect(() => {
      if (pageSize !== undefined && pageSize !== currentPageSize) {
        React.startTransition(() => setCurrentPageSize(pageSize));
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pageSize]);

    void effectivePage;
    void effectivePageSize;

    // Update URL query parameters when page or pageSize changes
    useEffect(() => {
      if (queryPaginationEnabled) {
        updateQueryParams({ page: currentPage, limit: currentPageSize });
      }
    }, [currentPage, currentPageSize, queryPaginationEnabled]);

    const handleSort = useCallback((field: Field<T>) => {
      setOrderBy(field);
      setOrderDirection((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    }, []);

    const handleFilter = useCallback((field: string, value: string) => {
      setFilters((prev) => ({
        ...prev,
        [field]: value,
      }));
    }, []);

    const handleExport = useCallback(() => {
      if (!data.length || typeof window === 'undefined') return;
      const exportColumns = columns.filter(
        (column) => visibleColumns[column.field as string] && !column.hidden,
      );
      const escape = (value: unknown) => {
        const normalized =
          value === null || value === undefined
            ? ''
            : typeof value === 'object'
              ? JSON.stringify(value)
              : String(value);
        return `"${normalized.replaceAll('"', '""')}"`;
      };
      const csv = [
        exportColumns.map((column) => escape(column.title)).join(','),
        ...data.map((row) => exportColumns.map((column) => escape(row[column.field])).join(',')),
      ].join('\n');
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${title?.trim().replaceAll(/\s+/g, '-').toLowerCase() || 'records'}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    }, [columns, data, title, visibleColumns]);

    const toggleRowExpansion = useCallback((rowId: RowIdentifier) => {
      setExpandedRows((prev) => {
        const newSet = new Set(prev);
        if (newSet.has(rowId)) {
          newSet.delete(rowId);
        } else {
          newSet.add(rowId);
        }
        return newSet;
      });
    }, []);

    // Memoized data processing
    const processData = useCallback(
      (inputData: T[]): T[] => {
        let processed = [...inputData];

        if (totalCount === undefined) {
          if (searchText) {
            processed = processed.filter((row) =>
              columns.some((column) => {
                const value = row[column.field];
                return value?.toString().toLowerCase().includes(searchText.toLowerCase());
              }),
            );
          }

          Object.entries(filters).forEach(([field, value]) => {
            if (value) {
              processed = processed.filter((row) => {
                const cellValue = row[field as keyof T];
                return cellValue?.toString().toLowerCase().includes(value.toLowerCase());
              });
            }
          });

          if (orderBy) {
            processed = lodash.orderBy(processed, [orderBy], [orderDirection]);
          }
        }

        return processed;
      },
      [columns, filters, orderBy, orderDirection, searchText, totalCount],
    );

    const processedData = useMemo(() => processData(data), [data, processData]);
    const displayData = useMemo(() => {
      if (totalCount !== undefined) {
        return processedData;
      }
      if (!options.pagination) {
        return processedData;
      }
      return processedData.slice(
        currentPage * currentPageSize,
        (currentPage + 1) * currentPageSize,
      );
    }, [currentPage, currentPageSize, options.pagination, processedData, totalCount]);

    const effectiveTotalCount = totalCount !== undefined ? totalCount : processedData.length;

    // Component resolution
    const {
      container: Container = DefaultContainer,
      toolbar: Toolbar = DefaultToolbar,
      customToolbar: CustomToolbar = CustomToolbarSection,
      pagination: Pagination = CustomPagination,
      loadingOverlay: LoadingOverlay = DefaultLoadingOverlay,
      emptyState: EmptyState = DefaultEmptyState,
      detailPanel: DetailPanel = DefaultDetailPanel,
    } = components;

    // Animation variants for Framer Motion
    const detailVariants = {
      hidden: { height: 0, opacity: 0 },
      visible: { height: 'auto', opacity: 1 },
    };

    // Render
    return (
      <div className={`relative h-fit min-w-0 ${containerClassName}`}>
        <Container className={className} options={options}>
          {(title || subtitle || description) && !options.toolbar && (
            <div className="flex flex-col py-3 pl-5">
              {title && <h2 className="text-lg font-bold text-gray-900">{title}</h2>}
              {(subtitle || description) && (
                <p className="mt-0.5 text-xs font-normal text-slate-500">
                  {subtitle || description}
                </p>
              )}
            </div>
          )}

          {options.toolbar && (
            <Toolbar
              title={title}
              subtitle={subtitle || description}
              onSearch={handleSearch}
              searchValue={searchText}
              onExport={handleExport}
              onRefresh={onRefresh}
              isRefreshing={isRefreshing}
              isValidating={isValidating}
              className="bg-white"
              showSearch={options.search}
              showExport={options.export}
              showRefresh={options.refresh ?? Boolean(onRefresh)}
            />
          )}

          {customToolbar && <CustomToolbar>{customToolbar}</CustomToolbar>}

          <div className="relative flex-1">
            {/* Loader - Shows in center over table when revalidating/refreshing or loading with data */}
            {(isLoading || isRefreshing || isValidating) && data.length > 0 && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/65 backdrop-blur-[1px] transition-all duration-200">
                <div className="flex flex-col items-center justify-center gap-2 rounded-2xl bg-white/95 px-6 py-4 shadow-xl border border-slate-100/80">
                  <div className="h-10 w-10 animate-spin rounded-full border-3 border-solid border-primary border-t-transparent"></div>
                  <span className="text-xs font-semibold text-slate-700">Updating records...</span>
                </div>
              </div>
            )}
            <div
              ref={tableContainerRef}
              className={`w-full ${options.verticalScroll ? 'overflow-y-auto' : ''} overflow-x-auto`}
              style={
                options.fixedHeight
                  ? {
                      flex: '1 1 0%',
                      overflow: 'auto',
                      maxHeight: options.maxHeight || 'unset',
                    }
                  : {}
              }
            >
              <table className="w-full min-w-[720px] table-auto border-separate border-spacing-0">
                <thead
                  className={`${options.theme?.headerBg || 'bg-gray-50'} ${options.stickyHeader ? 'sticky top-0 z-10' : ''}`}
                >
                  <tr>
                    {selection && (
                      <th className="w-12 px-4 py-3.5">
                        <input
                          type="checkbox"
                          checked={isAllSelected(displayData)}
                          onChange={() => toggleAll(displayData)}
                          className="mx-2 size-4 cursor-pointer rounded border-gray-300"
                        />
                      </th>
                    )}
                    {options.detailPanel && options.detailPanelPosition === 'left' && (
                      <th
                        className={`px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-[0.12em] ${options.theme?.headerText}`}
                      >
                        {options.detailPanelHeader}
                      </th>
                    )}
                    {columns.map(
                      (column) =>
                        visibleColumns[column.field as string] && (
                          <th
                            key={column.field as string}
                            className={`px-4 py-3.5 text-center text-xs font-semibold ${
                              options.theme?.headerText || 'text-slate-500'
                            } select-none uppercase tracking-[0.12em] border-t border-b border-r border-slate-100 last:border-r-0 ${
                              column.sortable !== false && options.sorting
                                ? `cursor-pointer ${options.theme?.headerHover || 'hover:bg-slate-100'}`
                                : ''
                            } ${column.headerClassName || ''} ${
                              column.sticky
                                ? `sticky z-20 ${options.theme?.headerBg || 'bg-slate-50'}`
                                : ''
                            }`}
                            onClick={() =>
                              column.sortable !== false &&
                              options.sorting &&
                              handleSort(column.field)
                            }
                            style={{
                              width: column.width,
                              minWidth: column.minWidth,
                              maxWidth: column.maxWidth,
                              ...(column.sticky
                                ? {
                                    ...stickyColumnPositions.get(column.field as string),
                                  }
                                : {}),
                            }}
                          >
                            <div className="flex w-full items-center justify-center gap-1.5">
                              <span className="text-nowrap">{column.title}</span>
                              {column.sortable !== false &&
                                options.sorting &&
                                orderBy === column.field &&
                                (orderDirection === 'asc' ? (
                                  <SortAsc
                                    className={`h-4 w-4 ${options.theme?.sortIconColor || 'text-primary'}`}
                                  />
                                ) : (
                                  <SortDesc
                                    className={`h-4 w-4 ${options.theme?.sortIconColor || 'text-primary'}`}
                                  />
                                ))}
                            </div>
                          </th>
                        ),
                    )}
                    {actions.length > 0 && (
                      <th className="w-fit text-nowrap px-4 py-3.5 text-center text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 border-t border-b border-slate-100">
                        {localization.header?.actions || 'Actions'}
                      </th>
                    )}
                    {options.detailPanel && options.detailPanelPosition === 'right' && (
                      <th
                        className={`text-nowrap px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-[0.12em] ${options.theme?.headerText}`}
                      >
                        {options.detailPanelHeader}
                      </th>
                    )}
                  </tr>

                  {filtering && (
                    <tr>
                      {selection && <th />}
                      {options.detailPanel && options.detailPanelPosition === 'left' && <th />}
                      {columns.map(
                        (column) =>
                          visibleColumns[column.field as string] &&
                          column.filterable !== false && (
                            <th
                              key={column.field as string}
                              className={`dark:border-white/10 flex size-full items-center justify-center border border-gray-200 px-6 py-2 ${
                                column.sticky
                                  ? `sticky z-20 ${options.theme?.headerBg || 'bg-gray-50'}`
                                  : ''
                              }`}
                              style={{
                                ...(column.sticky
                                  ? {
                                      ...stickyColumnPositions.get(column.field as string),
                                      borderRight:
                                        column.sticky === 'left' ? '1px solid' : undefined,
                                      borderLeft:
                                        column.sticky === 'right' ? '1px solid' : undefined,
                                      borderColor: 'inherit',
                                    }
                                  : {}),
                              }}
                            >
                              <input
                                type="text"
                                placeholder={localization.body?.filterRow?.filterPlaceholder}
                                className="w-full rounded border px-2 py-1 text-sm"
                                onChange={(e) =>
                                  handleFilter(column.field as string, e.target.value)
                                }
                                value={filters[column.field as string] || ''}
                              />
                            </th>
                          ),
                      )}
                      {actions.length > 0 && <th />}
                      {options.detailPanel && options.detailPanelPosition === 'right' && <th />}
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {(isLoading || isRefreshing || isValidating) && data?.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          Object.values(visibleColumns).filter(Boolean).length +
                          (selection ? 1 : 0) +
                          (actions.length > 0 ? 1 : 0) +
                          (options.detailPanel ? 1 : 0)
                        }
                        className="border border-gray-200"
                      >
                        <LoadingOverlay />
                      </td>
                    </tr>
                  ) : displayData.length === 0 ? (
                    <tr>
                      <td
                        colSpan={
                          Object.values(visibleColumns).filter(Boolean).length +
                          (selection ? 1 : 0) +
                          (actions.length > 0 ? 1 : 0) +
                          (options.detailPanel ? 1 : 0)
                        }
                        className="border border-gray-200"
                      >
                        <EmptyState />
                      </td>
                    </tr>
                  ) : (
                    displayData.map((row, rowIndex) => {
                      const rowId = getRowIdentifier(row, rowIndex);
                      const isExpanded = expandedRows.has(rowId);
                      const customRowClass = getRowClassName?.(row) || '';

                      return (
                        <React.Fragment key={rowId}>
                          <tr
                            onClick={() => onRowClick?.(row)}
                            className={`transition-colors duration-200 hover:bg-primary-50/40 ${onRowClick ? 'cursor-pointer' : ''} ${customRowClass}`}
                          >
                            {selection && (
                              <td
                                className={`w-12 px-4 py-3.5 text-center ${isExpanded ? 'blur-sm' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected(row, rowIndex)}
                                  onChange={() => toggleSelection(row, rowIndex)}
                                  className="mx-auto block size-4 cursor-pointer rounded border-gray-100"
                                />
                              </td>
                            )}
                            {options.detailPanel && options.detailPanelPosition === 'left' && (
                              <td className="w-12 px-4 py-3.5 text-center">
                                <div
                                  tabIndex={0}
                                  role="button"
                                  onClick={() => toggleRowExpansion(rowId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      toggleRowExpansion(rowId);
                                    }
                                  }}
                                  className="flex cursor-pointer items-center justify-center text-gray-400"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="size-6 -rotate-180" />
                                  ) : (
                                    <ChevronDown className="size-6 -rotate-90" />
                                  )}
                                </div>
                              </td>
                            )}
                            {columns.map((column, columnIndex) => {
                              const visibleColumnCount =
                                Object.values(visibleColumns).filter(Boolean).length;
                              const isLastVisibleColumn = columnIndex === visibleColumnCount - 1;
                              return visibleColumns[column.field as string] ? (
                                <td
                                  key={column.field as string}
                                  className={`px-4 py-3.5 ${isExpanded ? 'blur-sm' : ''} text-left text-sm text-slate-700 border-b border-r border-slate-100 last:border-r-0 ${
                                    column.cellClassName || ''
                                  } ${
                                    options.detailPanel &&
                                    ((options.detailPanelPosition === 'left' &&
                                      columnIndex === 0) ||
                                      (options.detailPanelPosition === 'right' &&
                                        isLastVisibleColumn))
                                      ? 'cursor-pointer hover:bg-gray-100'
                                      : ''
                                  } ${column.sticky ? 'sticky z-10 bg-white' : ''}`}
                                  style={{
                                    ...(column.sticky
                                      ? {
                                          ...stickyColumnPositions.get(column.field as string),
                                          borderRight:
                                            column.sticky === 'left' ? '1px solid' : undefined,
                                          borderLeft:
                                            column.sticky === 'right' ? '1px solid' : undefined,
                                          borderColor: 'inherit',
                                        }
                                      : {}),
                                  }}
                                  onClick={
                                    options.detailPanel &&
                                    ((options.detailPanelPosition === 'left' &&
                                      columnIndex === 0) ||
                                      (options.detailPanelPosition === 'right' &&
                                        isLastVisibleColumn))
                                      ? () => toggleRowExpansion(rowId)
                                      : undefined
                                  }
                                >
                                  <div>
                                    {column.expandable?.enabled
                                      ? (() => {
                                          const fieldKey = String(column.field);
                                          const text = column.render
                                            ? String(column.render(row) || 'Not Provided')
                                            : String(row[column.field] || 'Not Provided');
                                          const expanded = isTextExpanded(String(rowId), fieldKey);
                                          const lines = text.split('\n');
                                          const maxLines = column.expandable.maxLines;
                                          const maxChars = column.expandable.maxCharacters;

                                          // Check if truncation is needed
                                          const exceedsLines = maxLines && lines.length > maxLines;
                                          const exceedsChars = maxChars && text.length > maxChars;

                                          // For line clamping: also check if text is long enough to wrap
                                          // Assume ~50 chars per line as a rough estimate for wrapping
                                          // (accounts for typical column width constraints in table layouts)
                                          const estimatedCharsPerLine = 50;
                                          const likelyToWrap =
                                            maxLines &&
                                            !maxChars &&
                                            text.length > maxLines * estimatedCharsPerLine;

                                          const shouldShowMore =
                                            exceedsLines || exceedsChars || likelyToWrap;

                                          // Build inline styles for line clamping
                                          const clampStyles: CSSProperties =
                                            !expanded && maxLines
                                              ? {
                                                  display: '-webkit-box',
                                                  WebkitLineClamp: maxLines,
                                                  WebkitBoxOrient: 'vertical',
                                                  overflow: 'hidden',
                                                }
                                              : {};

                                          return (
                                            <div className="text-left">
                                              <motion.div
                                                key={`${rowId}-${fieldKey}-${expanded}`}
                                                initial={{ opacity: 0 }}
                                                animate={{ opacity: 1 }}
                                                exit={{ opacity: 0 }}
                                                transition={{ duration: 0.3 }}
                                              >
                                                <div style={clampStyles}>{text}</div>
                                              </motion.div>
                                              {shouldShowMore && (
                                                <motion.button
                                                  whileHover={{ scale: 1.05 }}
                                                  whileTap={{ scale: 0.95 }}
                                                  onClick={(e) => {
                                                    e.stopPropagation();
                                                    toggleTextExpansion(String(rowId), fieldKey);
                                                  }}
                                                  className="ml-1 text-sm font-medium text-primary-600 underline hover:text-primary-800"
                                                >
                                                  {expanded
                                                    ? column.expandable.showLessText || 'Show Less'
                                                    : column.expandable.showMoreText || 'Show More'}
                                                </motion.button>
                                              )}
                                            </div>
                                          );
                                        })()
                                      : column.render
                                        ? column.render(row)
                                        : String(row[column.field] ?? '')}
                                  </div>
                                </td>
                              ) : null;
                            })}
                            {actions.length > 0 && (
                              <td
                                className={`px-4 py-3.5 text-center text-sm font-medium whitespace-nowrap border-b border-slate-100 ${isExpanded ? 'blur-sm' : ''}`}
                              >
                                <div className="flex items-center justify-center gap-2">
                                  {actions.map(
                                    (action, actionIndex) =>
                                      !action.hidden?.(row) && (
                                        <div
                                          key={actionIndex}
                                          tabIndex={0}
                                          role="button"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            action.onClick(row);
                                          }}
                                          onKeyDown={(e) => {
                                            if (e.key === 'Enter') {
                                              e.stopPropagation();
                                              action.onClick(row);
                                            }
                                          }}
                                          className={
                                            (typeof action.className === 'function'
                                              ? action.className(row)
                                              : action.className) ||
                                            'inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center rounded-xl px-2.5 py-1 text-xs font-semibold text-slate-600 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30'
                                          }
                                          title={action.tooltip}
                                        >
                                          {typeof action.icon === 'function'
                                            ? action.icon(row)
                                            : action.icon}
                                        </div>
                                      ),
                                  )}
                                </div>
                              </td>
                            )}
                            {options.detailPanel && options.detailPanelPosition === 'right' && (
                              <td className="w-12 px-4 py-3.5 text-center">
                                <div
                                  tabIndex={0}
                                  role="button"
                                  onClick={() => toggleRowExpansion(rowId)}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      toggleRowExpansion(rowId);
                                    }
                                  }}
                                  className="flex cursor-pointer items-center justify-center text-gray-500 hover:text-gray-700"
                                >
                                  {isExpanded ? (
                                    <ChevronUp className="size-6 -rotate-180" />
                                  ) : (
                                    <ChevronDown className="size-6 -rotate-90" />
                                  )}
                                </div>
                              </td>
                            )}
                          </tr>

                          {options.detailPanel && expandedRows.has(rowId) && (
                            <tr key={`${rowId}-detail`}>
                              <td
                                colSpan={
                                  Object.values(visibleColumns).filter(Boolean).length +
                                  (selection ? 1 : 0) +
                                  (actions.length > 0 ? 1 : 0) +
                                  (options.detailPanel ? 1 : 0)
                                }
                                className="border border-gray-200"
                              >
                                <AnimatePresence>
                                  <motion.div
                                    key={`${rowId}-motion`}
                                    initial="hidden"
                                    animate="visible"
                                    exit="hidden"
                                    variants={detailVariants}
                                    transition={{
                                      duration: 0.3,
                                      ease: 'easeInOut',
                                    }}
                                  >
                                    {detailPanel ? (
                                      typeof detailPanel === 'function' ? (
                                        <div className="p-4">{detailPanel(row)}</div>
                                      ) : (
                                        <div className="p-4">{detailPanel}</div>
                                      )
                                    ) : (
                                      <DetailPanel row={row} />
                                    )}
                                  </motion.div>
                                </AnimatePresence>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {options.pagination && effectiveTotalCount > 0 && (
            <Pagination
              count={effectiveTotalCount}
              page={currentPage}
              rowsPerPage={currentPageSize}
              onPageChange={handlePageChange}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Container>
      </div>
    );
  },
);

CustomTable.displayName = 'CustomTable';

export default CustomTable as <T extends Record<string, unknown>>(
  props: CVTableProps<T> & { ref?: React.Ref<CVTableRef> },
) => React.ReactElement;
