import { createClient, ClientAPI }  from "contentful-management";

import { isLocalizedContent } from "./translateService";
import {ContentfulEnvironment, ContentfulLocale, TranslationsData} from "../types";

interface HandleFetchAllEntriesProperties {
    contentfulClient: ClientAPI;
    contentTypeId: string;
    spaceId: string;
}

interface FetchMissingTranslations {
    contentfulAccessToken: string | undefined;
    spaceId: string;
}
interface ExtractContentFromArraysProperties {
    content_EN: (string | unknown[])[];
    content_FR_CA: (string | unknown[])[];
    contentTypeId: string;
    entryId: string;
    fieldName: string;
    allEntries: TranslationsData[];
}
/**
 * Extracts content from arrays and handles nested arrays recursively.
 * @param {ExtractContentFromArraysProperties} params - The function parameters.
 */
const extractContentFromArrays = ({ content_EN, content_FR_CA, contentTypeId, entryId, fieldName, allEntries }: ExtractContentFromArraysProperties) => {
    if (Array.isArray(content_EN)) {
        for (let i = 0; i < content_EN.length; i++) {
            if (Array.isArray(content_EN[i])) {
                // If the content is a nested array, recursively handle it
                extractContentFromArrays({ content_EN: content_EN[i] as (string | unknown[])[], content_FR_CA: content_FR_CA?.[i] as (string | unknown[])[], contentTypeId, entryId, fieldName, allEntries });
            } else if (typeof content_EN[i] === "string") {
                const data: TranslationsData = {
                    contentTypeId,
                    entryId,
                    field: fieldName,
                    content_EN_US: content_EN[i] as string,
                    content_FR_CA: (content_FR_CA?.[i] as string) || undefined
                };
                allEntries.push(data);
            }else {
                console.log("Contentful linktype", content_EN[i]);
            }
        }
    } else {
        const data: TranslationsData = {
            contentTypeId,
            entryId,
            field: fieldName,
            content_EN_US: content_EN as string,
            content_FR_CA: content_FR_CA as unknown as string || undefined
        };
        allEntries.push(data);
    }
}

/**
 * Fetches all entries for a given content type from Contentful.
 * @async
 * @param {HandleFetchAllEntriesProperties} params - The function parameters.
 * @returns {Promise<TranslationsData[]>} - Array of all entries.
 */
const fetchAllEntries = async ({ contentfulClient, contentTypeId, spaceId }: HandleFetchAllEntriesProperties): Promise<TranslationsData[]> => {
    const allEntries: TranslationsData[] = [];
    const space = await contentfulClient.getSpace(spaceId);
    const environment = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT as ContentfulEnvironment);

    const contentType = await environment.getContentType(contentTypeId);

    const entries = await environment.getEntries({ content_type: contentTypeId, include: 10, limit: 1000 });

    entries.items.forEach((entry) => {
        for (const fieldName in entry.fields) {
            const fieldDefinition = contentType.fields.find(f => f.id === fieldName);

            if (!fieldDefinition?.localized) {
                continue;  // If the field is not localized, skip the checks.
            }

            const localizedContent_EN = entry.fields[fieldName][ContentfulLocale.EN];
            const localizedContent_FR_CA = entry.fields[fieldName][ContentfulLocale.FR_CA];

            if (typeof localizedContent_EN === "string") {
                const data = {
                    contentTypeId,
                    entryId: entry.sys.id,
                    field: fieldName,
                    content_EN_US: localizedContent_EN,
                    content_FR_CA: localizedContent_FR_CA || ""
                }
                allEntries.push(data);
            }
            if (Array.isArray(localizedContent_EN)) {
                extractContentFromArrays({
                    content_EN: localizedContent_EN,
                    content_FR_CA: localizedContent_FR_CA,
                    contentTypeId,
                    entryId: entry.sys.id,
                    fieldName,
                    allEntries
                });
            }
        }
    });
    return allEntries;
}

/**
 * Fetches missing translations from Contentful.
 * Iterates over all content types and their entries to identify untranslated content.
 * @async
 * @param {FetchMissingTranslations} params - The function parameters.
 * @returns {Promise<TranslationsData[]>} - Array of entries with missing translations.
 * @throws {Error} Throws an error if Contentful access token is not provided or any other error occurs during fetching.
 */

export const fetchMissingTranslations = async ({ spaceId, contentfulAccessToken }: FetchMissingTranslations): Promise<TranslationsData[]> => {
    if (!contentfulAccessToken) {
        throw new Error("Contentful access token is not provided");
    }
    try {
        const contentfulClient = createClient({
            accessToken: contentfulAccessToken,
        });
        const missingTranslations: TranslationsData[] = [];
        const space = await contentfulClient.getSpace(spaceId);
        const environment = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT as ContentfulEnvironment);
        const contentTypes = await environment.getContentTypes();
        for (const contentType of contentTypes.items) {
            const entries = await fetchAllEntries({ contentfulClient, contentTypeId: contentType.sys.id, spaceId });
            for (const entry of entries) {
                const { isLocalized} = await isLocalizedContent({ translatedContent: entry.content_FR_CA, locale: ContentfulLocale.FR_CA});
                if (!isLocalized) {
                    missingTranslations.push(entry);
                }
            }
        }
        return missingTranslations;
    }
    catch (error) {
        console.error("Error:", error);
        throw new Error("Error while fetching missing translations")
    }
}

