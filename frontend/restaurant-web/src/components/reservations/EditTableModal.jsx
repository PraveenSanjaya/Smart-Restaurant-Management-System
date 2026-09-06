import React, { useState, useEffect } from 'react';
import { updateTable } from '../../services/tableService';
import { validateTableEditForm, sanitizeTableEditPayload } from './tableValidation';

const LOCATION_OPTIONS = [
  'Main Dining',
  'Window',
  'Private Booth',
  'Patio',
  'Bar Area',
  'Balcony',
  'Other',
];

export default function EditTableModal({ isOpen, table, onClose, onTableUpdated }) {
  const [formData, setFormData] = useState({
    tableNumber: '',
    capacity: '4',
    location: 'Main Dining',
    customLocation: '',
    status: 'Available',
  });

  const [fieldErrors, setFieldErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize form data when table prop changes
  useEffect(() => {
    if (table) {
      const isPresetLocation = LOCATION_OPTIONS.slice(0, -1).includes(table.location);
      setFormData({
        tableNumber: table.tableNumber || '',
        capacity: table.capacity ? String(table.capacity) : '4',
        location: isPresetLocation ? table.location : 'Other',
        customLocation: isPresetLocation ? '' : (table.location || ''),
        status: table.status || (table.isActive ? 'Available' : 'Inactive'),
      });
      setFieldErrors({});
      setServerError('');
    }
  }, [table, isOpen]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen && !isSubmitting) {
        handleClose();
      }
    };

    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, isSubmitting]);

  if (!isOpen || !table) return null;

  const handleClose = () => {
    setFieldErrors({});
    setServerError('');
    onClose();
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    if (fieldErrors[name]) {
      setFieldErrors((prev) => ({
        ...prev,
        [name]: null,
      }));
    }
    setServerError('');
  };

  const isOccupiedBlocked =
    table?.status?.toLowerCase() === 'occupied' &&
    formData.status?.toLowerCase() !== 'available';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError('');

    if (isOccupiedBlocked) {
      setServerError(`Table '${table.tableNumber}' is currently occupied and cannot be edited. Please select 'Available' first.`);
      return;
    }

    const resolvedLocation =
      formData.location === 'Other'
        ? formData.customLocation
        : formData.location;

    const dataToValidate = {
      capacity: formData.capacity,
      location: resolvedLocation,
      status: formData.status,
    };

    const validation = validateTableEditForm(dataToValidate);
    if (!validation.isValid) {
      if (formData.location === 'Other' && validation.errors.location) {
        setFieldErrors({
          ...validation.errors,
          customLocation: validation.errors.location,
        });
      } else {
        setFieldErrors(validation.errors);
      }
      return;
    }

    setFieldErrors({});
    setIsSubmitting(true);

    try {
      const payload = sanitizeTableEditPayload(dataToValidate);
      const updated = await updateTable(table.id, payload);

      if (onTableUpdated) {
        onTableUpdated(updated);
      }
      handleClose();
    } catch (err) {
      const msg =
        err.response?.data?.message ||
        err.response?.data?.title ||
        err.message ||
        'Failed to update table. Please check the information and try again.';
      setServerError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onClick={handleClose}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(11, 13, 18, 0.7)',
        backdropFilter: 'blur(6px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        padding: '1rem',
        overflowY: 'auto',
      }}
    >
      <div
        className="modal-card"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: '#ffffff',
          borderRadius: '16px',
          padding: '1.5rem 1.85rem',
          maxWidth: '500px',
          width: '100%',
          maxHeight: 'min(92vh, 680px)',
          overflowY: 'auto',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.35)',
          border: '1px solid #e5e7eb',
          color: '#111827',
          position: 'relative',
          margin: 'auto',
          boxSizing: 'border-box',
        }}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            marginBottom: '1rem',
          }}
        >
          <div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: '700',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                color: '#d4af37',
                display: 'block',
                marginBottom: '0.2rem',
              }}
            >
              Modify Seating
            </span>
            <h2
              style={{
                fontSize: '1.3rem',
                fontWeight: '700',
                color: '#111827',
                margin: 0,
              }}
            >
              Edit Table {table.tableNumber}
            </h2>
          </div>

          <button
            type="button"
            onClick={handleClose}
            aria-label="Close modal"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#9ca3af',
              padding: '0.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'color 0.2s ease',
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#111827')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#9ca3af')}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Server Error Alert */}
        {serverError && (
          <div
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #f87171',
              color: '#991b1b',
              padding: '0.65rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            <span>{serverError}</span>
          </div>
        )}

        {/* Occupied Warning Banner */}
        {table.status === 'Occupied' && (
          <div
            style={{
              backgroundColor: formData.status === 'Available' ? '#ecfdf5' : '#fffbeb',
              border: formData.status === 'Available' ? '1px solid #a7f3d0' : '1px solid #fcd34d',
              color: formData.status === 'Available' ? '#065f46' : '#92400e',
              padding: '0.75rem 0.9rem',
              borderRadius: '8px',
              fontSize: '0.85rem',
              marginBottom: '1rem',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
            }}
          >
            {formData.status === 'Available' ? (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <div>
                  <span style={{ fontWeight: '600' }}>Releasing Table:</span> Status will be updated to <strong>Available</strong> upon saving.
                </div>
              </>
            ) : (
              <>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#d97706" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, marginTop: '2px' }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.15rem' }}>Table is Currently Occupied</div>
                  <p style={{ margin: 0, fontSize: '0.82rem', color: '#b45309', lineHeight: '1.35' }}>
                    Occupied tables cannot be modified or deleted. Select <strong>Available</strong> below to free the table and enable saving modifications.
                  </p>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, status: 'Available' }))}
                    style={{
                      marginTop: '0.45rem',
                      padding: '0.3rem 0.7rem',
                      fontSize: '0.78rem',
                      fontWeight: '600',
                      color: '#065f46',
                      backgroundColor: '#d1fae5',
                      border: '1px solid #6ee7b7',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.3rem',
                    }}
                  >
                    ✓ Set to Available
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          {/* Table Identifier (Immutable) */}
          <div style={{ marginBottom: '0.9rem' }}>
            <label
              htmlFor="editTableNumber"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.3rem',
              }}
            >
              Table Identifier <span style={{ fontSize: '0.75rem', fontWeight: '400', color: '#6b7280' }}>(Immutable)</span>
            </label>
            <input
              id="editTableNumber"
              name="tableNumber"
              type="text"
              value={table.tableNumber}
              disabled
              readOnly
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: '1px solid #e5e7eb',
                outline: 'none',
                color: '#6b7280',
                backgroundColor: '#f9fafb',
                boxSizing: 'border-box',
                cursor: 'not-allowed',
                fontWeight: '600',
              }}
            />
          </div>

          {/* Seating Capacity */}
          <div style={{ marginBottom: '0.9rem' }}>
            <label
              htmlFor="editCapacity"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.3rem',
              }}
            >
              Seating Capacity <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <input
              id="editCapacity"
              name="capacity"
              type="number"
              min="1"
              max="100"
              placeholder="e.g., 4"
              value={formData.capacity}
              onChange={handleChange}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: fieldErrors.capacity ? '1px solid #ef4444' : '1px solid #d1d5db',
                outline: 'none',
                color: '#111827',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
              }}
            />
            {fieldErrors.capacity && (
              <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
                {fieldErrors.capacity}
              </p>
            )}
          </div>

          {/* Location / Section */}
          <div style={{ marginBottom: '0.9rem' }}>
            <label
              htmlFor="editLocation"
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.3rem',
              }}
            >
              Location / Section <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <select
              id="editLocation"
              name="location"
              value={formData.location}
              onChange={handleChange}
              disabled={isSubmitting}
              style={{
                width: '100%',
                padding: '0.65rem 0.85rem',
                fontSize: '0.9rem',
                borderRadius: '8px',
                border: fieldErrors.location ? '1px solid #ef4444' : '1px solid #d1d5db',
                outline: 'none',
                color: '#111827',
                backgroundColor: '#ffffff',
                boxSizing: 'border-box',
              }}
            >
              {LOCATION_OPTIONS.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {formData.location === 'Other' && (
              <div style={{ marginTop: '0.4rem' }}>
                <input
                  type="text"
                  name="customLocation"
                  placeholder="Enter custom location/section name"
                  value={formData.customLocation}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{
                    width: '100%',
                    padding: '0.65rem 0.85rem',
                    fontSize: '0.9rem',
                    borderRadius: '8px',
                    border: fieldErrors.customLocation ? '1px solid #ef4444' : '1px solid #d1d5db',
                    outline: 'none',
                    color: '#111827',
                    backgroundColor: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
                {fieldErrors.customLocation && (
                  <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
                    {fieldErrors.customLocation}
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Status */}
          <div style={{ marginBottom: '1.4rem' }}>
            <label
              style={{
                display: 'block',
                fontSize: '0.85rem',
                fontWeight: '600',
                color: '#374151',
                marginBottom: '0.4rem',
              }}
            >
              Table Status
            </label>
            <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  color: formData.status === 'Available' ? '#111827' : '#6b7280',
                  fontWeight: formData.status === 'Available' ? '600' : '400',
                }}
              >
                <input
                  type="radio"
                  name="status"
                  value="Available"
                  checked={formData.status === 'Available'}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{ accentColor: '#10b981' }}
                />
                Available
              </label>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  color: formData.status === 'Occupied' ? '#b45309' : '#6b7280',
                  fontWeight: formData.status === 'Occupied' ? '600' : '400',
                }}
              >
                <input
                  type="radio"
                  name="status"
                  value="Occupied"
                  checked={formData.status === 'Occupied'}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{ accentColor: '#f59e0b' }}
                />
                Occupied
              </label>

              <label
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  fontSize: '0.88rem',
                  color: formData.status === 'Inactive' ? '#111827' : '#6b7280',
                  fontWeight: formData.status === 'Inactive' ? '600' : '400',
                }}
              >
                <input
                  type="radio"
                  name="status"
                  value="Inactive"
                  checked={formData.status === 'Inactive'}
                  onChange={handleChange}
                  disabled={isSubmitting}
                  style={{ accentColor: '#6b7280' }}
                />
                Inactive
              </label>
            </div>
            {fieldErrors.status && (
              <p style={{ color: '#ef4444', fontSize: '0.78rem', marginTop: '0.25rem', margin: '0.25rem 0 0' }}>
                {fieldErrors.status}
              </p>
            )}
          </div>

          {/* Action Buttons */}
          <div
            style={{
              display: 'flex',
              gap: '0.75rem',
              justifyContent: 'flex-end',
              alignItems: 'center',
            }}
          >
            <button
              type="button"
              onClick={handleClose}
              disabled={isSubmitting}
              className="btn-jelly-secondary"
              style={{
                padding: '0.65rem 1.3rem',
                fontSize: '0.88rem',
              }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isOccupiedBlocked}
              className="btn-jelly-primary"
              title={isOccupiedBlocked ? "Select 'Available' to enable saving changes for this occupied table" : ""}
              style={{
                padding: '0.65rem 1.45rem',
                fontSize: '0.88rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.5rem',
                opacity: isOccupiedBlocked ? 0.6 : 1,
                cursor: isOccupiedBlocked ? 'not-allowed' : 'pointer',
              }}
            >
              {isSubmitting ? (
                <>
                  <svg
                    style={{
                      animation: 'spin 1s linear infinite',
                      width: '15px',
                      height: '15px',
                    }}
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" opacity="0.25" />
                    <path
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  <span>Saving...</span>
                </>
              ) : isOccupiedBlocked ? (
                'Select Available to Save'
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
