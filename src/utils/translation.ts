import { TranslationServiceClient } from "@google-cloud/translate";
/**
 * Checks if the provided content is translated in the specified locale.
 * @param {string} content - The content to check for translation.
 * @param {string} locale - The target locale to check against.
 * @returns {Promise<boolean>} A boolean indicating whether the content is translated or not.
 *
 * @example
 * const result = await isContentTranslated({ content: "Bonjour", locale: "fr" });
 * console.log(result.isLocalized);  // Expected output: true
 */
export const isContentTranslated = async (content: string | undefined, locale: string): Promise< boolean> => {
    const projectId = process.env.GCP_PROJECT_ID;
    const location = process.env.GCP_LOCATION;
    const parent = `projects/${projectId}/locations/${location}`;
    const translateClient = new TranslationServiceClient();
    if (content) {
        const response = await translateClient.detectLanguage({
            parent,
            content,
            mimeType: 'text/plain'
        });
        if (Array.isArray(response)) {
            const detectedLanguage = response?.[0]?.languages?.[0].languageCode;
            if (detectedLanguage && locale.includes(detectedLanguage)) {
                return true
            }
        }
    }
    return false
}
