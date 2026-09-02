import React, { useState, useEffect, useMemo } from 'react';
import { Search, X, Star, Layers } from 'lucide-react';
import { INDICATOR_CATALOG } from './indicatorCatalog';
import { useIndicatorStore } from './useIndicatorStore';
import type { IndicatorType } from './types';
import './IndicatorModal.css';

interface IndicatorModalProps {
  isOpen: boolean;
  onClose: () => void;
}

type TabType = 'favorit' | 'semua';

export const IndicatorModal: React.FC<IndicatorModalProps> = ({ isOpen, onClose }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<TabType>('semua');
  const [favorites, setFavorites] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem('tv_indicator_favorites');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const { indicators, addIndicator } = useIndicatorStore();

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const toggleFavorite = (type: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setFavorites((prev) => {
      const next = { ...prev, [type]: !prev[type] };
      try {
        localStorage.setItem('tv_indicator_favorites', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  const handleSelectIndicator = (type: IndicatorType) => {
    addIndicator(type);
    window.dispatchEvent(
      new CustomEvent('show-toast', {
        detail: `Indikator berhasil ditambahkan ke chart!`,
      })
    );
  };

  const favoriteCount = useMemo(() => {
    return Object.values(favorites).filter(Boolean).length;
  }, [favorites]);

  const filteredCatalog = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    return INDICATOR_CATALOG.filter((item) => {
      // Tab filter
      if (activeTab === 'favorit' && !favorites[item.type]) {
        return false;
      }

      // Search query filter
      if (!query) return true;
      return (
        item.name.toLowerCase().includes(query) ||
        item.type.toLowerCase().includes(query) ||
        item.shortDesc.toLowerCase().includes(query)
      );
    });
  }, [searchQuery, activeTab, favorites]);

  if (!isOpen) return null;

  return (
    <div className="tv-ind-modal-backdrop" onClick={onClose}>
      <div className="tv-ind-modal-window" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="tv-ind-modal-header">
          <h2 className="tv-ind-modal-title">Indikator, metrik dan strategi</h2>
          <button className="tv-ind-modal-close" onClick={onClose} aria-label="Tutup">
            <X size={18} strokeWidth={1.8} />
          </button>
        </div>

        {/* Search Input Bar */}
        <div className="tv-ind-modal-search-wrap">
          <div className="tv-ind-search-box">
            <Search size={15} className="tv-ind-search-icon" />
            <input
              type="text"
              className="tv-ind-search-input"
              placeholder="Cari"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              autoFocus
            />
            {searchQuery && (
              <button
                className="tv-ind-search-clear"
                onClick={() => setSearchQuery('')}
                aria-label="Hapus pencarian"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Split Layout: Sidebar Navigation + Content List */}
        <div className="tv-ind-main-layout">
          {/* Left Sidebar */}
          <aside className="tv-ind-sidebar">
            <div className="tv-ind-sidebar-group">
              <div className="tv-ind-sidebar-label">PRIBADI</div>
              <button
                className={`tv-ind-sidebar-item ${activeTab === 'favorit' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('favorit')}
              >
                <Star
                  size={15}
                  className="tv-ind-sidebar-icon"
                  fill={activeTab === 'favorit' ? '#ffffff' : 'none'}
                  stroke={activeTab === 'favorit' ? '#ffffff' : 'currentColor'}
                  strokeWidth={1.7}
                />
                <span>Favorit</span>
                {favoriteCount > 0 && (
                  <span className="tv-ind-sidebar-badge">{favoriteCount}</span>
                )}
              </button>

              <button
                className={`tv-ind-sidebar-item ${activeTab === 'semua' ? 'is-active' : ''}`}
                onClick={() => setActiveTab('semua')}
              >
                <Layers size={15} className="tv-ind-sidebar-icon" strokeWidth={1.7} />
                <span>Semua</span>
              </button>
            </div>
          </aside>

          {/* Right Table / List View */}
          <section className="tv-ind-content-panel">
            {/* Table Header */}
            <div className="tv-ind-table-header">
              <div className="tv-ind-col-name">NAMA</div>
            </div>

            {/* Table List Rows */}
            <div className="tv-ind-table-body">
              {filteredCatalog.length === 0 ? (
                <div className="tv-ind-empty-state">
                  {activeTab === 'favorit' ? (
                    <>
                      <Star size={28} className="tv-ind-empty-icon" strokeWidth={1.2} />
                      <p>Belum ada indikator favorit</p>
                      <span>Klik ikon bintang (★) pada indikator untuk menambahkannya ke daftar Favorit</span>
                    </>
                  ) : (
                    <p>Tidak ada indikator yang sesuai dengan "{searchQuery}"</p>
                  )}
                </div>
              ) : (
                filteredCatalog.map((item) => {
                  const isFav = !!favorites[item.type];
                  const isAdded = indicators.some((i) => i.type === item.type);

                  return (
                    <div
                      key={item.type}
                      className={`tv-ind-row ${isAdded ? 'is-active-on-chart' : ''}`}
                      onClick={() => handleSelectIndicator(item.type)}
                    >
                      <div className="tv-ind-col-name">
                        <button
                          className={`tv-ind-star-btn ${isFav ? 'is-starred' : ''}`}
                          onClick={(e) => toggleFavorite(item.type, e)}
                          title={isFav ? 'Hapus dari favorit' : 'Tambah ke favorit'}
                        >
                          <Star
                            size={14}
                            fill={isFav ? '#f59e0b' : 'none'}
                            stroke={isFav ? '#f59e0b' : 'currentColor'}
                            strokeWidth={1.5}
                          />
                        </button>
                        <span className="tv-ind-item-name">{item.name}</span>
                        {isAdded && <span className="tv-ind-active-pill">Aktif</span>}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default IndicatorModal;
