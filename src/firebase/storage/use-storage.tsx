'use client';
import { useState, useCallback } from 'react';
import { useFirebase } from '@/firebase/provider';
import {
  FirebaseStorage,
  StorageReference,
  UploadTask,
  UploadTaskSnapshot,
  uploadBytesResumable,
} from 'firebase/storage';

export const useStorage = (): FirebaseStorage => {
    const { storage } = useFirebase();
    return storage;
}

export const useUploadFile = () => {
  const [isUploading, setIsUploading] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0);
  const [error, setError] = useState<Error | null>(null);
  const [snapshot, setSnapshot] = useState<UploadTaskSnapshot | null>(null);

  const uploadFile = useCallback(
    (storageRef: StorageReference, file: File | Blob) => {
      return new Promise<UploadTaskSnapshot>((resolve, reject) => {
        setIsUploading(true);
        setProgress(0);
        setError(null);
        setSnapshot(null);

        const uploadTask: UploadTask = uploadBytesResumable(storageRef, file);

        uploadTask.on(
          'state_changed',
          (snap: UploadTaskSnapshot) => {
            const prog = (snap.bytesTransferred / snap.totalBytes) * 100;
            setProgress(prog);
            setSnapshot(snap);
          },
          (err: Error) => {
            setError(err);
            setIsUploading(false);
            reject(err);
          },
          () => {
            setIsUploading(false);
            setSnapshot(uploadTask.snapshot);
            resolve(uploadTask.snapshot);
          }
        );
      });
    },
    []
  );

  return { isUploading, progress, error, snapshot, uploadFile };
};
