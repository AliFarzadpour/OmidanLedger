'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
  collection
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
}

// Helper Interface for internal Firestore types
export interface InternalQuery extends Query<DocumentData> {
  _query: {
    path: {
      canonicalString(): string;
      toString(): string;
    }
  }
}

/**
 * Helper: Safely extracts the string path from a Reference or Query.
 */
function getFirestorePath(target: CollectionReference<DocumentData> | Query<DocumentData>): string {
  if (target.type === 'collection') {
    return (target as CollectionReference).path;
  }
  // Safe access for Query objects to get the path
  return (target as unknown as InternalQuery)._query.path.canonicalString();
}

export function useCollection<T = any>(
  targetRefOrQuery: ((CollectionReference<DocumentData> | Query<DocumentData>)) | null | undefined,
): UseCollectionResult<T> {
  type ResultItemType = WithId<T>;
  type StateDataType = ResultItemType[] | null;

  const [data, setData] = useState<StateDataType>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);

  const path = useMemo(() => {
    if (!targetRefOrQuery) return null;
    try {
      return getFirestorePath(targetRefOrQuery);
    } catch (e) {
      // In some initial render cases, targetRefOrQuery might not be a valid Firestore object yet
      return null;
    }
  }, [targetRefOrQuery]);

  useEffect(() => {
    if (!targetRefOrQuery || !path) {
      setIsLoading(false);
      setData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);

    const unsubscribe = onSnapshot(
      targetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: ResultItemType[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        setData(results);
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        // Construct a helpful permission error
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: path, 
        });

        console.error(`Firestore Permission Error at path: ${path}`, err);
        setError(contextualError);
        setData(null);
        setIsLoading(false);

        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [targetRefOrQuery, path]); 

  return { data, isLoading, error };
}
