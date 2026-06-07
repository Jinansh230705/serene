'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import GalleryCard from '@/components/GalleryCard';
import Lightbox from '@/components/Lightbox';

interface CompiledMedia {
  url: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
}

interface Tweet {
  id: string;
  authorName: string;
  authorHandle: string;
  tweetUrl: string;
  text: string;
  hashtags: string[];
  media: CompiledMedia[];
  category: string;
  collectedAt: string;
}

interface GridItem {
  id: string;
  mediaIndex: number;
  tweet: Tweet;
  uniqueKey: string;
}

const CATEGORIES = [
  'All',
  'Digital Art',
  'Oil & Traditional Painting',
  'Sketches & Drawings',
  'Natural Scenery',
  'Concept Art & Studies',
  'Other'
];

export default function Home() {
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [gridItems, setGridItems] = useState<GridItem[]>([]);
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const [selectedGridItemIndex, setSelectedGridItemIndex] = useState<number | null>(null);
  const [isDevMode, setIsDevMode] = useState(false);
  const [columnCount, setColumnCount] = useState(1);
  const [seed, setSeed] = useState('');
  const [deletedIds, setDeletedIds] = useState<Set<string>>(new Set());

  const loaderRef = useRef<HTMLDivElement>(null);


  // Initialize dev mode detection and generate a random session seed on mount
  useEffect(() => {
    setIsDevMode(process.env.NODE_ENV === 'development');
    setSeed(Math.random().toString(36).substring(2, 15));
  }, []);

  // Update responsive column count based on window size
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w >= 1400) setColumnCount(4);
      else if (w >= 1024) setColumnCount(3);
      else if (w >= 640) setColumnCount(2);
      else setColumnCount(1);
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reset pagination when search or filter changes
  useEffect(() => {
    setPage(1);
    setGridItems([]);
    setTotalItems(0);
    setSelectedGridItemIndex(null);
    setDeletedIds(new Set());
  }, [search, category]);

  // Fetch paginated and filtered items on demand, using seed to randomize
  useEffect(() => {
    if (!seed) return; // Wait until client-side seed is initialized to fetch

    let active = true;
    const fetchData = async () => {
      setLoading(true);
      try {
        const queryParams = new URLSearchParams({
          page: String(page),
          limit: '40',
          category,
          search,
          seed
        });
        const response = await fetch(`/api/likes?${queryParams}`, {
          cache: 'no-store'
        });
        if (response.ok && active) {
          const data = await response.json();
          if (page === 1) {
            setGridItems(data.items);
          } else {
            setGridItems(prev => {
              const existingKeys = new Set(prev.map(item => item.uniqueKey));
              const newItems = data.items.filter((item: GridItem) => !existingKeys.has(item.uniqueKey));
              return [...prev, ...newItems];
            });
          }
          setTotalItems(data.total);
        }
      } catch (err) {
        console.error('Error fetching likes data:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchData();
    return () => {
      active = false;
    };
  }, [page, search, category, seed]);

  // Compute count of non-removed items loaded in client state
  const activeItemsCount = useMemo(() => {
    return gridItems.filter(item => !deletedIds.has(item.id)).length;
  }, [gridItems, deletedIds]);

  // Auto-load: observe a sentinel near the bottom, fires next page but stops
  // once all items have been loaded (activeItemsCount >= totalItems).
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !loading && activeItemsCount < totalItems) {
          setPage((prev) => prev + 1);
        }
      },
      { threshold: 0, rootMargin: '400px' }
    );

    if (loaderRef.current) {
      observer.observe(loaderRef.current);
    }

    return () => {
      if (loaderRef.current) {
        observer.unobserve(loaderRef.current);
      }
    };
  }, [loading, activeItemsCount, totalItems]);



  // Handle lightbox prev/next transitions skipping deleted items
  const handleNextGridItem = () => {
    if (selectedGridItemIndex !== null) {
      let nextIdx = selectedGridItemIndex + 1;
      while (nextIdx < gridItems.length && deletedIds.has(gridItems[nextIdx].id)) {
        nextIdx++;
      }
      if (nextIdx < gridItems.length) {
        setSelectedGridItemIndex(nextIdx);
      }
    }
  };

  const handlePrevGridItem = () => {
    if (selectedGridItemIndex !== null) {
      let prevIdx = selectedGridItemIndex - 1;
      while (prevIdx >= 0 && deletedIds.has(gridItems[prevIdx].id)) {
        prevIdx--;
      }
      if (prevIdx >= 0) {
        setSelectedGridItemIndex(prevIdx);
      }
    }
  };

  // Determine if active siblings exist to show modal chevrons
  const hasNextActiveItem = useMemo(() => {
    if (selectedGridItemIndex === null) return false;
    let nextIdx = selectedGridItemIndex + 1;
    while (nextIdx < gridItems.length && deletedIds.has(gridItems[nextIdx].id)) {
      nextIdx++;
    }
    return nextIdx < gridItems.length;
  }, [selectedGridItemIndex, gridItems, deletedIds]);

  const hasPrevActiveItem = useMemo(() => {
    if (selectedGridItemIndex === null) return false;
    let prevIdx = selectedGridItemIndex - 1;
    while (prevIdx >= 0 && deletedIds.has(gridItems[prevIdx].id)) {
      prevIdx--;
    }
    return prevIdx >= 0;
  }, [selectedGridItemIndex, gridItems, deletedIds]);

  const handleRemoveLike = async (id: string) => {
    try {
      const response = await fetch('/api/remove-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        // Track the deletion via client-side tombstone to maintain layout index stability
        setDeletedIds(prev => {
          const next = new Set(prev);
          next.add(id);
          return next;
        });
        setTotalItems(prev => prev - 1);
        setSelectedGridItemIndex(null);
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to remove.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to delete like.');
    }
  };

  // Shortest-column-first masonry: assigns each item to the column with the
  // least accumulated visual height, using image aspect ratios. This prevents
  // one column from being much taller than others due to portrait vs landscape images.
  const masonryColumns = useMemo(() => {
    const cols: GridItem[][] = Array.from({ length: columnCount }, () => []);
    const colHeights: number[] = new Array(columnCount).fill(0);

    gridItems.forEach((item) => {
      if (deletedIds.has(item.id)) return;

      // Find the shortest column
      let shortestCol = 0;
      for (let i = 1; i < columnCount; i++) {
        if (colHeights[i] < colHeights[shortestCol]) {
          shortestCol = i;
        }
      }

      cols[shortestCol].push(item);

      // Estimate visual height: 1 / aspectRatio (since all columns have equal width)
      const media = item.tweet.media[item.mediaIndex];
      const aspect = media?.aspectRatio || 1.333;
      colHeights[shortestCol] += 1 / aspect;
    });

    return cols;
  }, [gridItems, columnCount, deletedIds]);

  return (
    <div className="min-h-screen flex flex-col px-6 md:px-12 lg:px-20 py-12 md:py-20 max-w-[1920px] mx-auto w-full">

      {/* Header */}
      <header className="flex flex-col items-center text-center mb-16 md:mb-24">
        <h1 className="text-3xl md:text-5xl font-light tracking-[0.25em] text-[#2E2B29] uppercase mb-4">
          Sereine
        </h1>
        <p className="text-xs md:text-sm text-[#8E8477] tracking-[0.15em] uppercase font-medium">
          A Curated Gallery of Artworks
        </p>
      </header>

      {/* Filter and Search Section */}
      <div className="flex flex-col gap-6 md:gap-8 items-center justify-between mb-16 border-b border-[#EAE4D9] pb-8">

        {/* Categories Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-3 md:pb-0 max-w-full no-scrollbar justify-start md:justify-center w-full">
          <div className="flex flex-nowrap gap-1 md:gap-3 px-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategory(cat)}
                className={`whitespace-nowrap text-[10px] md:text-xs tracking-wider uppercase font-semibold px-4 py-2 rounded-full border transition-all duration-300 ${category === cat
                  ? 'bg-[#2E2B29] text-[#FBF9F6] border-[#2E2B29]'
                  : 'bg-transparent text-[#8E8477] border-transparent hover:border-[#EAE4D9] hover:text-[#2E2B29]'
                  }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Minimalist Search Bar */}
        <div className="relative w-full max-w-md mt-2 md:mt-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by artist, description, or keyword..."
            className="w-full text-xs md:text-sm bg-transparent border-b border-[#EAE4D9] focus:border-[#2E2B29] py-2.5 pl-2 pr-10 outline-none text-[#2E2B29] placeholder-[#8E8477]/60 transition-colors font-light"
          />
          <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#8E8477]/60 pointer-events-none">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </span>
        </div>
      </div>

      {/* Metadata / Status counter */}
      <div className="flex items-center justify-between text-[10px] md:text-xs tracking-widest text-[#8E8477] uppercase font-bold mb-8">
        <span>
          {activeItemsCount === 0 && !loading
            ? 'No artworks match selection'
            : `Showing ${activeItemsCount} of ${totalItems} artworks`}
        </span>
        {search && (
          <button
            onClick={() => setSearch('')}
            className="hover:underline hover:text-[#2E2B29] transition-colors cursor-pointer"
          >
            Clear Search
          </button>
        )}
      </div>

      {/* Masonry Columns Gallery */}
      {activeItemsCount > 0 ? (
        <main className="flex gap-6 md:gap-8 items-start w-full flex-grow">
          {masonryColumns.map((col, colIdx) => (
            <div key={colIdx} className="flex flex-col gap-6 md:gap-8 flex-1">
              {col.map((item) => (
                <GalleryCard
                  key={item.uniqueKey}
                  tweet={item.tweet}
                  mediaIndex={item.mediaIndex}
                  isDevMode={isDevMode}
                  onRemove={() => handleRemoveLike(item.id)}
                  onClick={() => {
                    const index = gridItems.findIndex(g => g.uniqueKey === item.uniqueKey);
                    setSelectedGridItemIndex(index);
                  }}
                />
              ))}
            </div>
          ))}
        </main>
      ) : (
        !loading && (
          <div className="flex-grow flex flex-col items-center justify-center py-32 text-center">
            <svg className="w-8 h-8 text-[#8E8477]/40 mb-4" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15l-5-5L5 21" />
            </svg>
            <span className="text-sm font-light text-[#8E8477]">No entries match your search criteria.</span>
          </div>
        )
      )}

      {/* Auto-load sentinel — stops when all items are loaded */}
      {activeItemsCount < totalItems && (
        <div
          ref={loaderRef}
          className="w-full flex justify-center py-12 mt-4"
        >
          {loading && (
            <span className="text-[10px] md:text-xs tracking-widest text-[#8E8477] uppercase animate-pulse font-semibold">
              Loading . . .
            </span>
          )}
        </div>
      )}

      {/* Lightbox Overlay */}
      {selectedGridItemIndex !== null && gridItems[selectedGridItemIndex] && (
        <Lightbox
          tweet={gridItems[selectedGridItemIndex].tweet}
          initialMediaIndex={gridItems[selectedGridItemIndex].mediaIndex}
          onClose={() => setSelectedGridItemIndex(null)}
          onNext={hasNextActiveItem ? handleNextGridItem : undefined}
          onPrev={hasPrevActiveItem ? handlePrevGridItem : undefined}
          isDevMode={isDevMode}
          onRemove={(removedId) => {
            handleRemoveLike(removedId);
          }}
        />
      )}

      {/* Footer */}
      <footer className="mt-20 border-t border-[#EAE4D9]/60 pt-8 flex items-center justify-center text-[10px] text-[#8E8477] tracking-wider uppercase font-semibold">
        <span>© {new Date().getFullYear()} Sereine Gallery</span>
      </footer>

    </div>
  );
}
