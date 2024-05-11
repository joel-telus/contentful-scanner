import { createClient, ClientAPI }  from "contentful-management";

import { isContentTranslated } from "./translation";
import {ContentfulEnvironment, ContentfulLocale, TranslationsData} from "../types";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";

interface FetchAllEntriesProperties {
    contentfulClient: ClientAPI;
    contentTypeId: string;
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
const createContentfulClient = async () => {
    const client = new SecretManagerServiceClient();
    const contentfulAccessTokenPath = "projects/47486989130/secrets/CONTENTFUL_ACCESS_TOKEN/versions/latest";
    const [contentfulSecret] = await client.accessSecretVersion({name: contentfulAccessTokenPath});
    const contentfulAccessToken = contentfulSecret?.payload?.data?.toString();
    if (!contentfulAccessToken) {
        throw new Error("Error retrieving contentful access token")
    }
    return createClient({
        accessToken: contentfulAccessToken,
    });
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
const fetchAllEntries = async ({ contentfulClient, contentTypeId, spaceId }: FetchAllEntriesProperties): Promise<TranslationsData[]> => {
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
 * @param spaceId - The id of the contentful space
 * @returns {Promise<TranslationsData[]>} - Array of entries with missing translations.
 */

export const fetchMissingTranslations = async (spaceId: string): Promise<TranslationsData[]> => {
    try {
        const contentfulClient = await createContentfulClient()
        const missingTranslations: TranslationsData[] = [];
        const space = await contentfulClient.getSpace(spaceId);
        const environment = await space.getEnvironment(process.env.CONTENTFUL_ENVIRONMENT as ContentfulEnvironment);
        const contentTypes = await environment.getContentTypes();
        for (const contentType of contentTypes.items) {
            const entries = await fetchAllEntries({ contentfulClient, contentTypeId: contentType.sys.id, spaceId });
            for (const entry of entries) {
                const isTranslated = await isContentTranslated(entry.content_FR_CA,  ContentfulLocale.FR_CA);
                if (!isTranslated) {
                    missingTranslations.push(entry);
                }
            }
        }
        return missingTranslations;
    }
    catch (error) {
        throw new Error(String(error))
    }
}

