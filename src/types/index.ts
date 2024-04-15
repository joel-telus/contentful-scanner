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
    content_EN_US: string;
    content_FR_CA: string | undefined;
}
