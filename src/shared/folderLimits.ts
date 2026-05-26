/** Deepest allowed folder level index (0 = root). Five UI levels = 0…4. Must match main + renderer. */
export const MAX_FOLDER_LEVEL = 4

/** Parent at this level cannot have children (same as `MAX_FOLDER_LEVEL`). */
export const MAX_FOLDER_PARENT_LEVEL_FOR_CHILD = MAX_FOLDER_LEVEL
