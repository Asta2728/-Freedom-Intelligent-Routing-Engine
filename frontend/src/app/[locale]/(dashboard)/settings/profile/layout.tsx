import { ReactNode } from "react";
import { ContentSection } from "../_components/content-section";

export default async function SettingsProfileLayout({
    children,
}: {
    children: ReactNode;
}) {
    return (
        <ContentSection
            title="Profile"
            desc="This is how others will see you on the site."
        >
            {children}
        </ContentSection>
    );
}