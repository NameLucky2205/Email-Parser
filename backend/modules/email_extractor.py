"""
Email Extractor Module
Извлечение email адресов из различных источников
"""

import re
import asyncio
from typing import List, Set, Dict, Optional
from urllib.parse import urlparse
import aiohttp
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)


class EmailExtractor:
    """Класс для извлечения email адресов из различных источников"""

    # Регулярное выражение для поиска email
    EMAIL_REGEX = re.compile(
        r'\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b'
    )

    # Более строгое регулярное выражение
    STRICT_EMAIL_REGEX = re.compile(
        r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    )

    def __init__(self):
        self.session = None

    async def _get_session(self) -> aiohttp.ClientSession:
        """Получить или создать aiohttp сессию"""
        if self.session is None or self.session.closed:
            self.session = aiohttp.ClientSession(
                headers={
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
                },
                timeout=aiohttp.ClientTimeout(total=30)
            )
        return self.session

    async def close(self):
        """Закрыть сессию"""
        if self.session and not self.session.closed:
            await self.session.close()

    def extract_from_text(self, text: str, strict: bool = False) -> List[str]:
        """
        Извлечь email адреса из текста

        Args:
            text: Текст для поиска
            strict: Использовать строгую валидацию

        Returns:
            Список найденных email адресов
        """
        if strict:
            # Разбить текст на слова и проверять каждое
            words = text.split()
            emails = [w for w in words if self.STRICT_EMAIL_REGEX.match(w)]
        else:
            emails = self.EMAIL_REGEX.findall(text)

        # Убрать дубликаты и преобразовать в lowercase
        unique_emails = list(set(email.lower() for email in emails))

        return sorted(unique_emails)

    async def extract_from_url(
        self,
        url: str,
        deep_crawl: bool = False,
        max_depth: int = 2
    ) -> Dict[str, any]:
        """
        Извлечь email адреса с веб-страницы

        Args:
            url: URL страницы
            deep_crawl: Сканировать ли ссылки на странице
            max_depth: Максимальная глубина сканирования

        Returns:
            Словарь с результатами
        """
        try:
            session = await self._get_session()

            # Нормализовать URL
            if not url.startswith(('http://', 'https://')):
                url = 'https://' + url

            # Загрузить страницу
            async with session.get(url) as response:
                if response.status != 200:
                    return {
                        'success': False,
                        'error': f'HTTP {response.status}',
                        'url': url,
                        'emails': []
                    }

                html = await response.text()
                soup = BeautifulSoup(html, 'html.parser')

                # Извлечь текст страницы
                text = soup.get_text()

                # Найти email в тексте
                emails_in_text = self.extract_from_text(text)

                # Найти email в атрибутах href="mailto:"
                mailto_links = soup.find_all('a', href=re.compile(r'^mailto:', re.I))
                emails_in_mailto = []
                for link in mailto_links:
                    href = link.get('href', '')
                    # Извлечь email из mailto:email@example.com
                    email_match = self.EMAIL_REGEX.search(href)
                    if email_match:
                        emails_in_mailto.append(email_match.group().lower())

                # Объединить результаты
                all_emails = list(set(emails_in_text + emails_in_mailto))

                result = {
                    'success': True,
                    'url': url,
                    'emails': sorted(all_emails),
                    'count': len(all_emails),
                    'sources': {
                        'text': len(emails_in_text),
                        'mailto': len(emails_in_mailto)
                    }
                }

                # Deep crawl если нужно
                if deep_crawl and max_depth > 0:
                    links = await self._extract_links(soup, url)
                    crawled_emails = await self._crawl_links(
                        links[:10],  # Ограничить до 10 ссылок
                        max_depth - 1
                    )

                    if crawled_emails:
                        result['crawled_emails'] = crawled_emails
                        result['total_with_crawl'] = len(
                            set(all_emails + crawled_emails)
                        )

                return result

        except asyncio.TimeoutError:
            return {
                'success': False,
                'error': 'Request timeout',
                'url': url,
                'emails': []
            }
        except Exception as e:
            logger.error(f"Error extracting from URL {url}: {e}")
            return {
                'success': False,
                'error': str(e),
                'url': url,
                'emails': []
            }

    async def _extract_links(self, soup: BeautifulSoup, base_url: str) -> List[str]:
        """Извлечь ссылки со страницы"""
        links = []
        base_domain = urlparse(base_url).netloc

        for a_tag in soup.find_all('a', href=True):
            href = a_tag['href']

            # Пропустить mailto и якоря
            if href.startswith(('mailto:', '#', 'javascript:')):
                continue

            # Абсолютный URL
            if href.startswith('http'):
                link_domain = urlparse(href).netloc
                # Только ссылки на том же домене
                if link_domain == base_domain:
                    links.append(href)
            # Относительный URL
            elif href.startswith('/'):
                parsed_base = urlparse(base_url)
                absolute_url = f"{parsed_base.scheme}://{parsed_base.netloc}{href}"
                links.append(absolute_url)

        return list(set(links))

    async def _crawl_links(self, links: List[str], depth: int) -> List[str]:
        """Рекурсивно сканировать ссылки"""
        if depth <= 0 or not links:
            return []

        all_emails = []

        tasks = [
            self.extract_from_url(link, deep_crawl=False)
            for link in links
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        for result in results:
            if isinstance(result, dict) and result.get('success'):
                all_emails.extend(result.get('emails', []))

        return list(set(all_emails))

    async def extract_from_file(self, file_path: str) -> Dict[str, any]:
        """
        Извлечь email адреса из файла

        Args:
            file_path: Путь к файлу

        Returns:
            Словарь с результатами
        """
        try:
            with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
                content = f.read()

            emails = self.extract_from_text(content)

            return {
                'success': True,
                'file': file_path,
                'emails': emails,
                'count': len(emails)
            }

        except Exception as e:
            logger.error(f"Error extracting from file {file_path}: {e}")
            return {
                'success': False,
                'error': str(e),
                'file': file_path,
                'emails': []
            }

    async def extract_bulk(
        self,
        sources: List[Dict[str, str]]
    ) -> Dict[str, any]:
        """
        Пакетная обработка множества источников

        Args:
            sources: Список источников [{'type': 'url/text/file', 'data': '...'}]

        Returns:
            Словарь с агрегированными результатами
        """
        tasks = []

        for source in sources:
            source_type = source.get('type')
            data = source.get('data')

            if source_type == 'url':
                tasks.append(self.extract_from_url(data))
            elif source_type == 'file':
                tasks.append(self.extract_from_file(data))
            elif source_type == 'text':
                # Синхронный метод, обернуть в корутину
                async def extract_text():
                    return {
                        'success': True,
                        'emails': self.extract_from_text(data),
                        'source': 'text'
                    }
                tasks.append(extract_text())

        results = await asyncio.gather(*tasks, return_exceptions=True)

        # Агрегировать результаты
        all_emails = []
        successful = 0
        failed = 0
        errors = []

        for i, result in enumerate(results):
            if isinstance(result, Exception):
                failed += 1
                errors.append({
                    'source': sources[i],
                    'error': str(result)
                })
            elif isinstance(result, dict):
                if result.get('success'):
                    successful += 1
                    all_emails.extend(result.get('emails', []))
                else:
                    failed += 1
                    errors.append({
                        'source': sources[i],
                        'error': result.get('error', 'Unknown error')
                    })

        unique_emails = list(set(all_emails))

        return {
            'success': True,
            'total_sources': len(sources),
            'successful': successful,
            'failed': failed,
            'emails': sorted(unique_emails),
            'total_emails': len(unique_emails),
            'errors': errors if errors else None
        }
