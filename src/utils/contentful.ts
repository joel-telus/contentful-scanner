import { createClient, ClientAPI }  from "contentful-management";

import { isContentTranslated } from "./translation";
import {ContentfulEnvironment, ContentfulLocale, TranslationsData} from "../types/global";
import {SecretManagerServiceClient} from "@google-cloud/secret-manager";

interface FetchAllEntriesProperties {
    contentfulClient: ClientAPI;
    contentTypeId: string;
    spaceId: string;
}
interface ExtractContentFromArraysProperties {
    enContent: (string | unknown[])[];
    frContent: (string | unknown[])[];
    contentTypeId: string;
    entryId: string;
    fieldName: string;
    allEntries: TranslationsData[];
}
const createContentfulClient = async () => {
    const client = new SecretManagerServiceClient();
    const contentfulAccessTokenPath = "projects/47486989130/secrets/CONTENTFUL_ACCESS_TOKEN/versions/latest";
    const [contentfulSecret] = await client.accessSecretVersion({name: contentfulAccessTokenPath});
    const accessToken = contentfulSecret?.payload?.data?.toString();
    if (!accessToken) {
        throw new Error("Error retrieving contentful access token")
    }
    return createClient({ accessToken });
}
/**
 * Extracts content from arrays and handles nested arrays recursively.
 * @param {ExtractContentFromArraysProperties} params - The function parameters.
 */
const extractContentFromArrays = ({ enContent, frContent, contentTypeId, entryId, fieldName, allEntries }: ExtractContentFromArraysProperties) => {
    if (Array.isArray(enContent)) {
        for (let i = 0; i < enContent.length; i++) {
            if (Array.isArray(enContent[i])) {
                extractContentFromArrays({ enContent: enContent[i] as (string | unknown[])[], frContent: frContent?.[i] as (string | unknown[])[], contentTypeId, entryId, fieldName, allEntries });
            } else if (typeof enContent[i] === "string") {
                const data: TranslationsData = {
                    contentTypeId,
                    entryId,
                    field: fieldName,
                    enContent: enContent[i] as string,
                    frContent: (frContent?.[i] as string) || undefined
                };
                allEntries.push(data);
            }else {
                console.log("Contentful linktype", enContent[i]);
            }
        }
    } else {
        const data: TranslationsData = {
            contentTypeId,
            entryId,
            field: fieldName,
            enContent: enContent as string,
            frContent: frContent as unknown as string || undefined
        };
        allEntries.push(data);
    }
}

/**
 * Fetches all entries for a given content type from Contentful.
 * @async
 * @param {FetchAllEntriesProperties} params - The function parameters.
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
            const enContent = entry.fields[fieldName][ContentfulLocale.EN];
            const frContent = entry.fields[fieldName][ContentfulLocale.FR_CA];

            if (typeof enContent === "string") {
                const data = {
                    contentTypeId,
                    entryId: entry.sys.id,
                    field: fieldName,
                    enContent,
                    frContent: frContent || ""
                }
                allEntries.push(data);
            }
            if (Array.isArray(enContent)) {
                extractContentFromArrays({
                    enContent,
                    frContent,
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
                const isTranslated = await isContentTranslated(entry.frContent,  ContentfulLocale.FR_CA);
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
