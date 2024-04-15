import { TranslationServiceClient } from "@google-cloud/translate";
interface IIsLocalizedContentProperties {
    translatedContent: string | undefined;
    locale: string;
}

interface IIsLocalizedContentReturn {
    isLocalized: boolean;
}

/**
 * Checks if the provided content is localized in the specified locale.
 *
 * @async
 * @function
 * @param {object} params - The function parameters.
 * @param {string} params.translatedContent - The content to check for localization.
 * @param {string} params.locale - The target locale to check against.
 *
 * @returns {Promise<IIsLocalizedContentReturn>} An object indicating whether the content is localized or not.
 * @throws {Error} Throws an error if any problem occurs while detecting the language.
 *
 * @example
 * const result = await isLocalizedContent({ translatedContent: "Bonjour", locale: "fr" });
 * console.log(result.isLocalized);  // Expected output: true
 */
export const isLocalizedContent = async ({ translatedContent, locale } : IIsLocalizedContentProperties): Promise<IIsLocalizedContentReturn> => {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;
    const parent = `projects/${projectId}/locations/${location}`;
    const translateClient = new TranslationServiceClient();
    if (translatedContent) {
        const response = await translateClient.detectLanguage({
            parent,
            content: translatedContent,
            mimeType: 'text/plain'
        });
        if (Array.isArray(response)) {
            const detectedLanguage = response?.[0]?.languages?.[0].languageCode;
            if (detectedLanguage && locale.includes(detectedLanguage)) {
                return {
                    isLocalized: true,
                }
            }
        }
    }
    return {
        isLocalized: false,
    }
}
