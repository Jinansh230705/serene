'use client';

import React, { useState, useEffect, useRef } from 'react';

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

interface GalleryCardProps {
  tweet: Tweet;
  onClick: () => void;
  mediaIndex?: number;
  isDevMode?: boolean;
  onRemove?: (e: React.MouseEvent) => void;
}

export default function GalleryCard({ tweet, onClick, mediaIndex = 0, isDevMode, onRemove }: GalleryCardProps) {
  const [loaded, setLoaded] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  const activeMedia = tweet.media[mediaIndex] || tweet.media[0];
  const aspect = activeMedia?.aspectRatio || 1.333; // Fallback to 4:3
  const isMultiImage = tweet.media.length > 1;

  // Clean the tweet text to look like a clean description or title
  const cleanText = tweet.text
    .replace(/https:\/\/t\.co\/\w+/g, '') // remove twitter t.co links
    .trim();

  // If the image is already cached and loaded before client-side hydration, onLoad won't fire.
  // We check imgRef.current.complete in a useEffect to transition the state.
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
  }, []);

  return (
    <div 
      onClick={onClick}
      className="group relative masonry-item cursor-pointer skeuo-frame w-full"
      style={{ 
        aspectRatio: aspect,
        breakInside: 'avoid'
      }}
    >
      {/* Dev Mode Floating Delete Button */}
      {isDevMode && onRemove && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(e);
          }}
          className="absolute top-1.5 left-1.5 bg-[#FAF8F5]/95 hover:bg-red-50 hover:text-red-600 hover:border-red-200 border border-[#EAE4D9] p-1.5 rounded-full z-30 shadow-sm transition-all duration-300 cursor-pointer"
          title="Remove from gallery"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
          </svg>
        </button>
      )}

      {/* Recessed Screen Area */}
      <div className="skeuo-screen w-full h-full relative">
        {/* Dynamic skeleton/loading placeholder with exact aspect ratio */}
        {!loaded && (
          <div className="absolute inset-0 bg-[#EAE5DB]/60 animate-pulse flex items-center justify-center z-10">
            <span className="text-[10px] tracking-widest text-[#8E8477]/60 uppercase font-semibold">Loading</span>
          </div>
        )}

        {/* Main Image */}
        {activeMedia?.url && (
          <img
            ref={imgRef}
            src={activeMedia.url}
            alt={cleanText || `Artwork by ${tweet.authorName} - Item ${mediaIndex + 1}`}
            loading="lazy"
            onLoad={() => setLoaded(true)}
            onError={() => setLoaded(true)}
            className={`w-full h-full object-cover transition-all duration-700 ease-out ${
              loaded ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
            } group-hover:scale-105`}
          />
        )}

        {/* Multi-image Collection indicator */}
        {isMultiImage && (
          <div className="absolute top-2.5 right-2.5 bg-[#FBF9F6]/95 border border-[#EAE4D9]/80 px-2 py-0.5 rounded-full z-10 flex items-center gap-1 shadow-sm backdrop-blur-sm">
            <svg className="w-2.5 h-2.5 text-[#8E8477]" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-[8px] font-semibold text-[#8E8477] tracking-wider uppercase">
              Collection
            </span>
          </div>
        )}

        {/* Elegant Hover Overlay */}
        <div className="absolute inset-0 bg-[#FAF8F5]/90 opacity-0 group-hover:opacity-100 transition-all duration-500 ease-in-out p-5 flex flex-col justify-between backdrop-blur-[2px] z-20">
          {/* Category & Artist tag */}
          <div className="flex flex-col gap-1">
            <span className="text-[9px] tracking-widest text-[#8E8477] uppercase font-bold">
              {tweet.category}
            </span>
            <h3 className="text-xs font-semibold text-[#2E2B29] tracking-tight truncate leading-tight">
              {tweet.authorName}
            </h3>
            <span className="text-[9px] text-[#8E8477] font-medium leading-none">
              @{tweet.authorHandle}
            </span>
          </div>

          {/* Text / Artist Attribution details */}
          <div className="mt-2.5 flex-grow overflow-hidden">
            <p className="text-[11px] text-[#5C544A] font-light leading-relaxed line-clamp-4 italic">
              {cleanText ? `"${cleanText}"` : 'No text description available.'}
            </p>
          </div>

          {/* Action button */}
          <div className="mt-2 flex items-center justify-between border-t border-[#EAE4D9]/50 pt-2.5">
            <span className="text-[8px] tracking-wider text-[#8E8477] uppercase font-semibold">
              {isMultiImage ? 'Collection' : 'View Details'}
            </span>
            <svg className="w-3.5 h-3.5 text-[#8E8477] transform group-hover:translate-x-1 transition-transform duration-300" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}
