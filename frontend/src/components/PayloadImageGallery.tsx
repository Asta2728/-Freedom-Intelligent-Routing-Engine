"use client";

import React, { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Image as ImageIcon, X } from "lucide-react";
import Image from "next/image";

export interface ImageFile {
  label: string;
  path: string;
  type?: "image" | "file";
}

interface PayloadImageGalleryProps {
  images: ImageFile[];
  apiUrl: string;
  onImageOpen?: (imagePath: string) => void;
}

export function PayloadImageGallery({
  images,
  apiUrl,
  onImageOpen,
}: PayloadImageGalleryProps) {
  const [selectedImage, setSelectedImage] = useState<ImageFile | null>(null);
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());

  if (images.length === 0) return null;

  const isValidImageType = (path: string): boolean => {
    const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp", ".svg"];
    return imageExtensions.some((ext) =>
      path.toLowerCase().endsWith(ext)
    );
  };

  const imageFiles = images.filter((img) => isValidImageType(img.path));

  if (imageFiles.length === 0) return null;

  const handleImageLoad = (imagePath: string) => {
    setImageErrors((prev) => {
      const next = new Set(prev);
      next.delete(imagePath);
      return next;
    });
  };

  const handleImageError = (imagePath: string) => {
    setImageErrors((prev) => new Set([...prev, imagePath]));
  };

  const handleOpenImage = (image: ImageFile) => {
    setSelectedImage(image);
    onImageOpen?.(image.path);
  };

  return (
    <>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="w-full justify-start gap-2 border-primary/30 hover:border-primary/60 hover:bg-primary/5"
          >
            <ImageIcon className="h-4 w-4 text-primary" />
            <span className="text-xs font-medium">
              Images ({imageFiles.length})
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-96 p-0" align="start">
          <div className="max-h-[400px] overflow-hidden">
            <div className="sticky top-0 border-b bg-muted/50 px-4 py-3 backdrop-blur-sm">
              <h3 className="text-sm font-semibold text-foreground">
                Task Images
              </h3>
            </div>
            <div className="overflow-y-auto max-h-[350px] space-y-2 p-3">
              {imageFiles.map((image) => (
                <div
                  key={image.path}
                  className="group overflow-hidden rounded-lg border border-border/50 bg-card transition-all hover:border-primary/30 hover:shadow-sm"
                >
                  <button
                    onClick={() => handleOpenImage(image)}
                    className="w-full space-y-2 p-3 text-left transition-colors hover:bg-muted/30"
                  >
                    {/* Image Thumbnail Preview */}
                    {!imageErrors.has(image.path) && (
                      <div className="relative h-32 w-full overflow-hidden rounded bg-muted">
                        <Image
                          src={`${apiUrl}/media/${image.path}`}
                          alt={image.label}
                          fill
                          className="object-cover transition-transform group-hover:scale-105"
                          onError={() => handleImageError(image.path)}
                          onLoad={() => handleImageLoad(image.path)}
                          unoptimized
                        />
                      </div>
                    )}

                    {imageErrors.has(image.path) && (
                      <div className="flex h-32 items-center justify-center rounded bg-muted">
                        <div className="text-center">
                          <ImageIcon className="mx-auto h-8 w-8 text-muted-foreground/50" />
                          <p className="mt-1 text-xs text-muted-foreground">
                            Preview unavailable
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Image Label */}
                    <div>
                      <p className="truncate text-xs font-medium text-foreground group-hover:text-primary">
                        {image.label}
                      </p>
                      <p className="truncate text-[10px] text-muted-foreground">
                        {image.path.split("/").pop()}
                      </p>
                    </div>
                  </button>
                </div>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {/* Full Image Modal */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={() => setSelectedImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw] overflow-hidden rounded-lg bg-black"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setSelectedImage(null)}
              className="absolute right-4 top-4 z-10 rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-black/70"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="relative h-auto w-auto">
              {!imageErrors.has(selectedImage.path) && (
                <Image
                  src={`${apiUrl}/media/${selectedImage.path}`}
                  alt={selectedImage.label}
                  width={1920}
                  height={1080}
                  className="max-h-[90vh] w-auto object-contain"
                  onError={() => handleImageError(selectedImage.path)}
                  onLoad={() => handleImageLoad(selectedImage.path)}
                  unoptimized
                />
              )}
              {imageErrors.has(selectedImage.path) && (
                <div className="flex h-96 w-96 items-center justify-center bg-muted">
                  <div className="text-center">
                    <ImageIcon className="mx-auto h-16 w-16 text-muted-foreground/30" />
                    <p className="mt-4 text-sm text-muted-foreground">
                      Unable to load image
                    </p>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/50 bg-muted/50 px-4 py-3">
              <p className="text-sm font-medium text-foreground">
                {selectedImage.label}
              </p>
              <p className="truncate text-xs text-muted-foreground">
                {selectedImage.path}
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
