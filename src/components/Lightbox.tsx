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

interface LightboxProps {
  tweet: Tweet;
  onClose: () => void;
  onNext?: () => void;
  onPrev?: () => void;
  isDevMode?: boolean;
  onRemove?: (id: string) => void;
  initialMediaIndex?: number;
}

export default function Lightbox({ tweet, onClose, onNext, onPrev, isDevMode, onRemove, initialMediaIndex = 0 }: LightboxProps) {
  const [currentImgIndex, setCurrentImgIndex] = useState(initialMediaIndex);
  const [loaded, setLoaded] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);

  // Reset states when tweet or initial index changes
  useEffect(() => {
    setCurrentImgIndex(initialMediaIndex);
    setLoaded(false);
  }, [tweet, initialMediaIndex]);

  // Check if image is already cached and complete
  useEffect(() => {
    if (imgRef.current && imgRef.current.complete) {
      setLoaded(true);
    }
  }, [currentImgIndex, tweet]);

  const handleRemove = async () => {
    setIsRemoving(true);
    try {
      const response = await fetch('/api/remove-like', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id: tweet.id }),
      });

      if (response.ok) {
        if (onRemove) {
          onRemove(tweet.id);
        }
      } else {
        const data = await response.json();
        alert(`Error: ${data.error || 'Failed to remove.'}`);
      }
    } catch (err) {
      console.error(err);
      alert('Failed to send remove request.');
    } finally {
      setIsRemoving(false);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (tweet.media.length > 1 && currentImgIndex < tweet.media.length - 1) {
          // Switch image in the same tweet
          setCurrentImgIndex(prev => prev + 1);
          setLoaded(false);
        } else if (onNext) {
          // Switch to next tweet
          onNext();
        }
      } else if (e.key === 'ArrowLeft') {
        if (tweet.media.length > 1 && currentImgIndex > 0) {
          // Switch image in the same tweet
          setCurrentImgIndex(prev => prev - 1);
          setLoaded(false);
        } else if (onPrev) {
          // Switch to prev tweet
          onPrev();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [tweet, currentImgIndex, onClose, onNext, onPrev]);

  const activeMedia = tweet.media[currentImgIndex];
  const hasMultipleImages = tweet.media.length > 1;

  const cleanText = tweet.text
    .replace(/https:\/\/t\.co\/\w+/g, '') // remove t.co links
    .trim();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 backdrop-blur-md bg-[#FAF8F5]/80 transition-all duration-300">
      
      {/* Viewport Floating Tweet Navigation Buttons */}
      {onPrev && (
        <button
          onClick={onPrev}
          className="fixed lightbox-btn-prev transform -translate-y-1/2 p-2.5 md:p-3.5 rounded-full bg-[#FAF8F5]/95 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] hover:shadow-md transition-all z-50 cursor-pointer shadow-sm"
          aria-label="Previous artwork"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18.75 19.5l-7.5-7.5 7.5-7.5m-6 15L5.25 12l7.5-7.5" />
          </svg>
        </button>
      )}
      {onNext && (
        <button
          onClick={onNext}
          className="fixed lightbox-btn-next transform -translate-y-1/2 p-2.5 md:p-3.5 rounded-full bg-[#FAF8F5]/95 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] hover:shadow-md transition-all z-50 cursor-pointer shadow-sm"
          aria-label="Next artwork"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 4.5l7.5 7.5-7.5 7.5m-6-15l7.5 7.5-7.5 7.5" />
          </svg>
        </button>
      )}

      {/* Main Container (Skeuomorphic Device Frame) */}
      <div className="relative w-full max-w-6xl skeuo-lightbox-frame z-10 flex h-[90vh] md:h-[80vh] overflow-hidden">
          
          {/* Close Button on the Bezel */}
          <button 
            onClick={onClose}
            className="absolute top-2 right-2 md:top-4 md:right-4 z-30 p-1.5 md:p-2 rounded-full bg-[#FAF8F5]/90 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] transition-colors shadow-sm cursor-pointer"
            aria-label="Close lightbox"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          {/* Recessed Screen Area */}
          <div className="skeuo-screen flex flex-col md:flex-row w-full h-full overflow-hidden relative">

            {/* Media Preview Section (Left/Center) */}
            <div className="relative flex-grow bg-[#F5F2EB] flex items-center justify-center p-4 md:p-8 h-[55%] md:h-full group">
              
              {/* Loading Indicator */}
              {!loaded && (
                <div className="absolute inset-0 bg-[#F5F2EB] flex items-center justify-center z-10">
                  <span className="text-xs tracking-widest text-[#8E8477] uppercase animate-pulse">Loading artwork</span>
                </div>
              )}

              {/* Active Image */}
              {activeMedia?.url && (
                <img
                  ref={imgRef}
                  src={activeMedia.url}
                  alt={cleanText || `Artwork by ${tweet.authorName}`}
                  onLoad={() => setLoaded(true)}
                  onError={() => setLoaded(true)}
                  className={`max-w-full max-h-full object-contain transition-opacity duration-500 ${
                    loaded ? 'opacity-100' : 'opacity-0'
                  }`}
                />
              )}

              {/* Carousel Controls (within the same tweet) */}
              {hasMultipleImages && (
                <>
                  {currentImgIndex > 0 && (
                    <button
                      onClick={() => {
                        setCurrentImgIndex(prev => prev - 1);
                        setLoaded(false);
                      }}
                      className="absolute left-6 md:left-8 p-2 rounded-full bg-[#FAF8F5]/85 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                      </svg>
                    </button>
                  )}
                  {currentImgIndex < tweet.media.length - 1 && (
                    <button
                      onClick={() => {
                        setCurrentImgIndex(prev => prev + 1);
                        setLoaded(false);
                      }}
                      className="absolute right-6 md:right-8 p-2 rounded-full bg-[#FAF8F5]/85 border border-[#EAE4D9] text-[#8E8477] hover:text-[#2E2B29] transition-all opacity-0 group-hover:opacity-100 cursor-pointer"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
                      </svg>
                    </button>
                  )}

                {/* Indicator dots */}
                <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex gap-1.5 z-10 bg-[#FBF9F6]/80 px-3 py-1.5 rounded-full border border-[#EAE4D9]/60 backdrop-blur-sm">
                  {tweet.media.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => {
                        setCurrentImgIndex(i);
                        setLoaded(false);
                      }}
                      className={`w-1.5 h-1.5 rounded-full transition-all cursor-pointer ${
                        i === currentImgIndex ? 'bg-[#2E2B29] scale-125' : 'bg-[#8E8477]/40'
                      }`}
                    />
                  ))}
                </div>
              </>
            )}


          </div>

          {/* Metadata Details Sidebar (Right) */}
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-[#EAE4D9]/80 p-6 md:p-8 bg-[#FBF9F6] flex flex-col justify-between h-[45%] md:h-full overflow-y-auto z-10">
            <div>
              {/* Category tag */}
              <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-bold block mb-4">
                {tweet.category}
              </span>

              {/* Artist Attribution */}
              <div className="mb-6">
                <h2 className="text-lg font-bold text-[#2E2B29] tracking-tight leading-snug">
                  {tweet.authorName}
                </h2>
                <a 
                  href={`https://x.com/${tweet.authorHandle}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[#8E8477] hover:text-[#2E2B29] hover:underline inline-flex items-center gap-1 mt-1 font-medium transition-colors"
                >
                  @{tweet.authorHandle}
                  <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                  </svg>
                </a>
              </div>

              {/* Collection Thumbnails ("From the same collection") */}
              {tweet.media.length > 1 && (
                <div className="mb-6 border-t border-[#EAE4D9]/50 pt-5">
                  <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-semibold block mb-2.5">
                    From the same collection
                  </span>
                  <div className="flex gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
                    {tweet.media.map((m, idx) => (
                      <button
                        key={idx}
                        onClick={() => {
                          setCurrentImgIndex(idx);
                          setLoaded(false);
                        }}
                        className={`relative w-12 h-12 flex-shrink-0 rounded-sm overflow-hidden border transition-all duration-300 cursor-pointer ${
                          idx === currentImgIndex
                            ? 'border-[#2E2B29] scale-105 shadow-sm'
                            : 'border-[#EAE4D9] hover:border-[#8E8477]'
                        }`}
                      >
                        <img
                          src={m.url}
                          alt={`Collection item ${idx + 1}`}
                          className="w-full h-full object-cover"
                        />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Description (Post Text) */}
              <div className="mb-6 border-t border-[#EAE4D9]/50 pt-5">
                <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-semibold block mb-2">
                  Attribution Text
                </span>
                <p className="text-sm text-[#5C544A] leading-relaxed italic font-light whitespace-pre-wrap">
                  {cleanText ? `"${cleanText}"` : 'No post description provided by the artist.'}
                </p>
              </div>
            </div>

            {/* Technical Metadata (Wallpaper Engine Details) */}
            <div className="border-t border-[#EAE4D9]/50 pt-5">
              <span className="text-[10px] tracking-widest text-[#8E8477] uppercase font-semibold block mb-3">
                Image Metadata
              </span>
              <div className="grid grid-cols-2 gap-y-3 gap-x-4 text-xs font-medium text-[#8E8477]">
                <div>
                  <span className="block text-[9px] text-[#8E8477]/60 uppercase tracking-wider mb-0.5">Resolution</span>
                  <span className="text-[#2E2B29]">
                    {activeMedia?.width && activeMedia?.height 
                      ? `${activeMedia.width} × ${activeMedia.height}` 
                      : 'Unresolved'}
                  </span>
                </div>
                <div>
                  <span className="block text-[9px] text-[#8E8477]/60 uppercase tracking-wider mb-0.5">Aspect Ratio</span>
                  <span className="text-[#2E2B29]">
                    {activeMedia?.aspectRatio 
                      ? `${activeMedia.aspectRatio.toFixed(2)}:1` 
                      : 'Unresolved'}
                  </span>
                </div>
                <div className="col-span-2">
                  <span className="block text-[9px] text-[#8E8477]/60 uppercase tracking-wider mb-0.5">Source URL</span>
                  <a 
                    href={tweet.tweetUrl} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-xs text-[#2E2B29] hover:underline truncate block max-w-full hover:text-black transition-colors"
                  >
                    {tweet.tweetUrl}
                  </a>
                </div>
              </div>
            </div>

            {/* Development mode delete control */}
            {isDevMode && onRemove && (
              <div className="border-t border-[#EAE4D9]/50 pt-4 mt-4">
                <button
                  disabled={isRemoving}
                  onClick={handleRemove}
                  className="w-full text-center py-2 px-3 border rounded text-[10px] tracking-widest uppercase font-semibold transition-all duration-300 cursor-pointer bg-[#FBF9F6] text-[#8E8477] border-[#EAE4D9] hover:border-red-300 hover:text-red-500 hover:bg-red-50/20"
                >
                  {isRemoving ? 'Removing...' : 'Remove from Gallery'}
                </button>
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  );
}
