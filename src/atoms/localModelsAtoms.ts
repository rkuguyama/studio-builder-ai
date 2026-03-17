import { atom } from "jotai";
import type { LocalModel } from "@platform/shared-types";

export const localModelsAtom = atom<LocalModel[]>([]);
export const localModelsLoadingAtom = atom<boolean>(false);
export const localModelsErrorAtom = atom<Error | null>(null);

export const lmStudioModelsAtom = atom<LocalModel[]>([]);
export const lmStudioModelsLoadingAtom = atom<boolean>(false);
export const lmStudioModelsErrorAtom = atom<Error | null>(null);
