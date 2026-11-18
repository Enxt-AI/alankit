"use client";

import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuthStore } from "@/store/auth-store";
import {
  getUserLikesApi,
  toggleLikeApi,
  syncGuestLikesApi,
  UserLikesResponse,
} from "@/lib/content-api";
import type { News, Article } from "@/types/content";

const LOCAL_STORAGE_KEY = "unlistedstox_liked_content_v1";

interface LocalStoredLikedData {
  likedIds: Record<string, boolean>;
  likedItems: Array<(News | Article) & { contentType: "news" | "article" }>;
}

export function useLikedContent() {
  const queryClient = useQueryClient();
  const { user, isAuthenticated } = useAuthStore();

  // Local storage state for guest / unauthenticated users
  const [localLikedIds, setLocalLikedIds] = useState<Record<string, boolean>>({});
  const [localLikedItems, setLocalLikedItems] = useState<
    Array<(News | Article) & { contentType: "news" | "article" }>
  >([]);
  const [isLocalLoaded, setIsLocalLoaded] = useState(false);

  // Load from localStorage on mount (guest mode)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (stored) {
        const parsed: LocalStoredLikedData = JSON.parse(stored);
        if (parsed.likedIds) setLocalLikedIds(parsed.likedIds);
        if (parsed.likedItems) setLocalLikedItems(parsed.likedItems);
      }
    } catch (e) {
      console.error("Failed to load local liked content", e);
    } finally {
      setIsLocalLoaded(true);
    }
  }, []);

  // React Query for authenticated user likes
  const { data: serverLikesData, isLoading: isQueryLoading } = useQuery<UserLikesResponse>({
    queryKey: ["user-content-likes", user?.id],
    queryFn: getUserLikesApi,
    enabled: !!isAuthenticated && !!user?.id,
    staleTime: 60000,
  });

  // Auto-sync guest likes to backend upon user login
  useEffect(() => {
    if (isAuthenticated && user?.id && isLocalLoaded && localLikedItems.length > 0) {
      const guestItemsToSync = localLikedItems.map((item) => ({
        id: item.id,
        contentType: item.contentType,
      }));

      syncGuestLikesApi(guestItemsToSync)
        .then((updatedServerData) => {
          queryClient.setQueryData(["user-content-likes", user.id], updatedServerData);
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          setLocalLikedIds({});
          setLocalLikedItems([]);
        })
        .catch((err) => console.error("Failed to sync guest likes to database", err));
    }
  }, [isAuthenticated, user?.id, isLocalLoaded, localLikedItems, queryClient]);

  // Toggle Like Mutation with Optimistic Updates
  const toggleLikeMutation = useMutation({
    mutationFn: ({
      item,
      contentType,
    }: {
      item: News | Article;
      contentType: "news" | "article";
    }) => toggleLikeApi(contentType, item.id),
    onMutate: async ({ item, contentType }) => {
      await queryClient.cancelQueries({ queryKey: ["user-content-likes", user?.id] });
      const previousLikes = queryClient.getQueryData<UserLikesResponse>([
        "user-content-likes",
        user?.id,
      ]);

      if (previousLikes) {
        const isCurrentlyLiked = !!previousLikes.likedIds[item.id];
        const updatedLikedIds = { ...previousLikes.likedIds };
        let updatedLikedItems = [...previousLikes.likedItems];

        if (isCurrentlyLiked) {
          delete updatedLikedIds[item.id];
          updatedLikedItems = updatedLikedItems.filter((i) => i.id !== item.id);
        } else {
          updatedLikedIds[item.id] = true;
          const itemWithMeta = { ...item, contentType };
          updatedLikedItems = [itemWithMeta, ...updatedLikedItems.filter((i) => i.id !== item.id)];
        }

        queryClient.setQueryData(["user-content-likes", user?.id], {
          likedIds: updatedLikedIds,
          likedItems: updatedLikedItems,
        });
      }

      return { previousLikes };
    },
    onError: (_err, _variables, context) => {
      if (context?.previousLikes) {
        queryClient.setQueryData(["user-content-likes", user?.id], context.previousLikes);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["user-content-likes", user?.id] });
    },
  });

  // Toggle like handler (handles both guest & authenticated state)
  const toggleLike = (item: News | Article, type: "news" | "article", e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }

    if (isAuthenticated && user?.id) {
      toggleLikeMutation.mutate({ item, contentType: type });
    } else {
      // Guest mode fallback via localStorage
      setLocalLikedIds((prevIds) => {
        const isCurrentlyLiked = !!prevIds[item.id];
        const nextLiked = !isCurrentlyLiked;
        const updatedIds = { ...prevIds };

        if (nextLiked) {
          updatedIds[item.id] = true;
        } else {
          delete updatedIds[item.id];
        }

        setLocalLikedItems((prevItems) => {
          let updatedItems: Array<(News | Article) & { contentType: "news" | "article" }>;
          if (nextLiked) {
            const itemWithMeta = { ...item, contentType: type };
            updatedItems = [itemWithMeta, ...prevItems.filter((i) => i.id !== item.id)];
          } else {
            updatedItems = prevItems.filter((i) => i.id !== item.id);
          }

          try {
            localStorage.setItem(
              LOCAL_STORAGE_KEY,
              JSON.stringify({ likedIds: updatedIds, likedItems: updatedItems })
            );
          } catch (err) {
            console.error("Failed to save local liked content", err);
          }

          return updatedItems;
        });

        return updatedIds;
      });
    }
  };

  const likedIds = isAuthenticated && user?.id ? serverLikesData?.likedIds || {} : localLikedIds;
  const likedItems = isAuthenticated && user?.id ? serverLikesData?.likedItems || [] : localLikedItems;

  const isLiked = (id: string) => !!likedIds[id];

  return {
    likedIds,
    likedItems,
    isLiked,
    toggleLike,
    isLoaded: isAuthenticated ? !isQueryLoading : isLocalLoaded,
    isAuthenticated,
  };
}
