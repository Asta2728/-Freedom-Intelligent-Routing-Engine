import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarRail,
} from "@/components/ui/sidebar";
import { useAuthStore } from "@/store/auth-store";
import { getFilteredSidebarData } from "./data/sidebar-data";
import { NavGroup } from "./nav-group";
import { NavUser } from "./nav-user";
import { useLayout } from "./providers/layout-provider";

export function AppSidebar() {
    const { collapsible, variant } = useLayout();
    const { user } = useAuthStore();
    const sidebarData = getFilteredSidebarData(user);

    return (
        <Sidebar collapsible={collapsible} variant={variant}>
            <SidebarContent>
                {sidebarData.navGroups.map((props) => (
                    <NavGroup key={props.title} {...props} />
                ))}
            </SidebarContent>
            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
            <SidebarRail />
        </Sidebar>
    );
}