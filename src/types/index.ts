export enum EContentfulEnvironment {
    DEVELOPMENT = "DEV",
}

export enum EContentfulLocale {
    EN = "en-US",
    FR_CA = "fr-CA",
}

export interface ITranslationsData {
    contentTypeId: string;
    entryId: string;
    field: string;
    content_EN_US: string;
    content_FR_CA: string | undefined;
}
