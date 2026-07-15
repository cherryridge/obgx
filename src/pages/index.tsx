import { ReactNode } from "react";
import styles from "./index.module.css";
import useDocusaurusContext from "@docusaurus/useDocusaurusContext";
import Layout from "@theme/Layout";
import Heading from "@theme/Heading";
import Translate from "@docusaurus/Translate";
import Link from "@docusaurus/Link";

export default function Home() :ReactNode{
    const { siteConfig } = useDocusaurusContext();
    return(<Layout description="Homepage of OBGX documentation.">
        <header className={styles.banner}>
            <Heading as="h1" className="hero__title">{siteConfig.title}</Heading>
            <p className="hero__subtitle">{siteConfig.tagline}</p>
            <div style={{
                display: "flex",
                flexFlow: "row wrap",
                justifyContent: "center",
                alignItems: "center",
                gap: "1rem"
            }}>
                <div className={styles.buttons}>
                    <Link className="button button--secondary button--lg" to="overview">
                        <Translate id="homepage.getStarted">Get Started From the Overview</Translate>
                    </Link>
                </div>
            </div>
        </header>
    </Layout>);
}