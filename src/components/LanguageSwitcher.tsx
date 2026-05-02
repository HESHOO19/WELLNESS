import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";

const LanguageSwitcher = () => {
	const { isArabic, setLanguage } = useLanguage();

	return (
		<Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setLanguage(isArabic ? "en" : "ar") }>
			{isArabic ? "EN" : "AR"}
		</Button>
	);
};

export default LanguageSwitcher;
