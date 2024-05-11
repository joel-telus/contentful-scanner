export enum ContentfulEnvironment {
    DEVELOPMENT = "DEV",
}

export enum ContentfulLocale {
    EN = "en-US",
    FR_CA = "fr-CA",
}

export interface TranslationsData {
    contentTypeId: string;
    entryId: string;
    field: string;
    enContent: string;
    frContent: string | undefined;
}
