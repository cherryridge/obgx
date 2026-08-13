import editionData from "@site/.generated/editionData";
import {Redirect, useLocation} from "@docusaurus/router";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import type {ReactNode} from "react";
import {resolveModuleRedirect} from "../../moduleRedirects.mjs";

interface RootProps {
    readonly children: ReactNode;
}

export default function Root({children}: RootProps) {
    const location = useLocation();
    const {siteConfig} = useDocusaurusContext();
    const target = resolveModuleRedirect(location.pathname, siteConfig.baseUrl, editionData.redirects);

    return target === undefined
        ? children
        : <Redirect to={`${target}${location.search}${location.hash}`} />;
}