import { cn } from '../../lib/utils';
import { CheckCircle, XCircle, Clock, AlertCircle, Archive } from 'lucide-react';

export type StatusType = 'ACTIF' | 'INACTIF' | 'EN_INSTANCE' | 'ARCHIVE' | 'SUCCESS' | 'WARNING' | 'ERROR' | 'INFO';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const STATUS_CONFIG: Record<StatusType, { bg: string; text: string; border: string; icon: React.ElementType; defaultLabel: string }> = {
  ACTIF: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: CheckCircle,
    defaultLabel: 'Actif',
  },
  INACTIF: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
    defaultLabel: 'Inactif',
  },
  EN_INSTANCE: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: Clock,
    defaultLabel: 'En instance',
  },
  ARCHIVE: {
    bg: 'bg-gray-100',
    text: 'text-gray-600',
    border: 'border-gray-200',
    icon: Archive,
    defaultLabel: 'Archivé',
  },
  SUCCESS: {
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    icon: CheckCircle,
    defaultLabel: 'Succès',
  },
  WARNING: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    icon: AlertCircle,
    defaultLabel: 'Alerte',
  },
  ERROR: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    border: 'border-red-200',
    icon: XCircle,
    defaultLabel: 'Erreur',
  },
  INFO: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    border: 'border-blue-200',
    icon: AlertCircle,
    defaultLabel: 'Info',
  },
};

const SIZE_CLASSES = {
  sm: 'px-2 py-0.5 text-[10px] gap-1',
  md: 'px-2.5 py-1 text-[11px] gap-1.5',
  lg: 'px-3 py-1.5 text-[13px] gap-2',
};

const ICON_SIZES = {
  sm: 12,
  md: 14,
  lg: 16,
};

export function StatusBadge({
  status,
  label,
  size = 'md',
  showIcon = true,
  className,
}: StatusBadgeProps) {
  const config = STATUS_CONFIG[status];
  const Icon = config.icon;
  const displayLabel = label || config.defaultLabel;

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-medium',
        config.bg,
        config.text,
        config.border,
        SIZE_CLASSES[size],
        className
      )}
    >
      {showIcon && <Icon size={ICON_SIZES[size]} className="flex-shrink-0" />}
      {displayLabel}
    </span>
  );
}

// ── Helper: Map string status to StatusType ──

export function mapStatusToType(status: string | boolean | undefined): StatusType {
  if (typeof status === 'boolean') {
    return status ? 'ACTIF' : 'INACTIF';
  }
  if (typeof status === 'string') {
    const normalized = status.toUpperCase();
    if (['ACTIF', 'ACTIVE', 'ACTIVATED', 'TRUE'].includes(normalized)) return 'ACTIF';
    if (['INACTIF', 'INACTIVE', 'DEACTIVATED', 'FALSE', 'DISABLED'].includes(normalized)) return 'INACTIF';
    if (['EN_INSTANCE', 'PENDING', 'EN_ATTENTE', 'PROVISOIRE'].includes(normalized)) return 'EN_INSTANCE';
    if (['ARCHIVE', 'ARCHIVED', 'OBSOLETE'].includes(normalized)) return 'ARCHIVE';
  }
  return 'INFO';
}

// ── Convenience components ──

export function ActiveBadge({ label = 'Actif', size = 'md', showIcon = true }: { label?: string; size?: 'sm' | 'md' | 'lg'; showIcon?: boolean }) {
  return <StatusBadge status="ACTIF" label={label} size={size} showIcon={showIcon} />;
}

export function InactiveBadge({ label = 'Inactif', size = 'md', showIcon = true }: { label?: string; size?: 'sm' | 'md' | 'lg'; showIcon?: boolean }) {
  return <StatusBadge status="INACTIF" label={label} size={size} showIcon={showIcon} />;
}

export function PendingBadge({ label = 'En instance', size = 'md', showIcon = true }: { label?: string; size?: 'sm' | 'md' | 'lg'; showIcon?: boolean }) {
  return <StatusBadge status="EN_INSTANCE" label={label} size={size} showIcon={showIcon} />;
}

export function ArchivedBadge({ label = 'Archivé', size = 'md', showIcon = true }: { label?: string; size?: 'sm' | 'md' | 'lg'; showIcon?: boolean }) {
  return <StatusBadge status="ARCHIVE" label={label} size={size} showIcon={showIcon} />;
}