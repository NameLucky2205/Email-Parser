"""
Email Validator Module
Валидация email адресов, проверка MX записей, одноразовых email
"""

import re
import asyncio
import dns.resolver
import dns.exception
from typing import Dict, List, Optional
import aiohttp
import logging

logger = logging.getLogger(__name__)


class EmailValidator:
    """Класс для валидации email адресов"""

    # Строгое регулярное выражение для email
    EMAIL_REGEX = re.compile(
        r'^[a-zA-Z0-9][a-zA-Z0-9._%+-]*@[a-zA-Z0-9][a-zA-Z0-9.-]*\.[a-zA-Z]{2,}$'
    )

    # Список популярных одноразовых email доменов
    DISPOSABLE_DOMAINS = {
        '10minutemail.com', 'guerrillamail.com', 'mailinator.com',
        'temp-mail.org', 'throwaway.email', 'tempmail.com',
        'getnada.com', 'maildrop.cc', 'trashmail.com',
        'fakeinbox.com', 'mohmal.com', 'sharklasers.com',
        'spam4.me', 'yopmail.com', 'emailondeck.com'
    }

    # Список популярных провайдеров
    POPULAR_PROVIDERS = {
        'gmail.com': 'Gmail',
        'yahoo.com': 'Yahoo',
        'outlook.com': 'Outlook',
        'hotmail.com': 'Hotmail',
        'icloud.com': 'iCloud',
        'mail.ru': 'Mail.ru',
        'yandex.ru': 'Yandex',
        'protonmail.com': 'ProtonMail',
        'aol.com': 'AOL'
    }

    def __init__(self):
        self.dns_resolver = dns.resolver.Resolver()
        self.dns_resolver.timeout = 5
        self.dns_resolver.lifetime = 5

    def validate_format(self, email: str) -> Dict[str, any]:
        """
        Валидация формата email адреса

        Args:
            email: Email адрес для проверки

        Returns:
            Словарь с результатами валидации
        """
        email = email.strip().lower()

        # Базовая проверка
        if not email or '@' not in email:
            return {
                'valid': False,
                'email': email,
                'error': 'Invalid format: missing @'
            }

        # Проверка регулярным выражением
        if not self.EMAIL_REGEX.match(email):
            return {
                'valid': False,
                'email': email,
                'error': 'Invalid format'
            }

        # Разбить на username и domain
        try:
            username, domain = email.rsplit('@', 1)
        except ValueError:
            return {
                'valid': False,
                'email': email,
                'error': 'Invalid format: multiple @ symbols'
            }

        # Проверки username
        if len(username) == 0:
            return {
                'valid': False,
                'email': email,
                'error': 'Empty username'
            }

        if len(username) > 64:
            return {
                'valid': False,
                'email': email,
                'error': 'Username too long (max 64 characters)'
            }

        # Проверки domain
        if len(domain) == 0:
            return {
                'valid': False,
                'email': email,
                'error': 'Empty domain'
            }

        if len(domain) > 255:
            return {
                'valid': False,
                'email': email,
                'error': 'Domain too long (max 255 characters)'
            }

        # Проверка что домен содержит точку
        if '.' not in domain:
            return {
                'valid': False,
                'email': email,
                'error': 'Invalid domain: no TLD'
            }

        # Проверка TLD
        tld = domain.split('.')[-1]
        if len(tld) < 2:
            return {
                'valid': False,
                'email': email,
                'error': 'Invalid TLD'
            }

        return {
            'valid': True,
            'email': email,
            'username': username,
            'domain': domain,
            'tld': tld
        }

    async def check_mx_records(self, domain: str) -> Dict[str, any]:
        """
        Проверка MX записей домена

        Args:
            domain: Доменное имя

        Returns:
            Словарь с результатами проверки MX
        """
        try:
            # Получить MX записи
            mx_records = self.dns_resolver.resolve(domain, 'MX')

            mx_list = []
            for mx in mx_records:
                mx_list.append({
                    'priority': mx.preference,
                    'host': str(mx.exchange).rstrip('.')
                })

            # Сортировать по приоритету
            mx_list.sort(key=lambda x: x['priority'])

            return {
                'has_mx': True,
                'mx_records': mx_list,
                'primary_mx': mx_list[0]['host'] if mx_list else None,
                'mx_count': len(mx_list)
            }

        except dns.resolver.NoAnswer:
            return {
                'has_mx': False,
                'error': 'No MX records found'
            }
        except dns.resolver.NXDOMAIN:
            return {
                'has_mx': False,
                'error': 'Domain does not exist'
            }
        except dns.exception.Timeout:
            return {
                'has_mx': False,
                'error': 'DNS timeout'
            }
        except Exception as e:
            logger.error(f"Error checking MX for {domain}: {e}")
            return {
                'has_mx': False,
                'error': str(e)
            }

    def check_disposable(self, domain: str) -> Dict[str, any]:
        """
        Проверка является ли домен одноразовым

        Args:
            domain: Доменное имя

        Returns:
            Словарь с результатами проверки
        """
        is_disposable = domain.lower() in self.DISPOSABLE_DOMAINS

        return {
            'is_disposable': is_disposable,
            'domain': domain
        }

    def get_provider_info(self, domain: str) -> Dict[str, any]:
        """
        Получить информацию о провайдере

        Args:
            domain: Доменное имя

        Returns:
            Информация о провайдере
        """
        domain_lower = domain.lower()

        if domain_lower in self.POPULAR_PROVIDERS:
            return {
                'is_popular': True,
                'provider': self.POPULAR_PROVIDERS[domain_lower],
                'domain': domain
            }

        # Проверить популярные домены с поддоменами (e.g., yahoo.co.uk)
        for popular_domain, provider in self.POPULAR_PROVIDERS.items():
            if domain_lower.endswith('.' + popular_domain) or domain_lower == popular_domain:
                return {
                    'is_popular': True,
                    'provider': provider,
                    'domain': domain
                }

        return {
            'is_popular': False,
            'provider': 'Custom/Unknown',
            'domain': domain
        }

    async def validate_email(
        self,
        email: str,
        check_mx: bool = True,
        check_disposable: bool = True
    ) -> Dict[str, any]:
        """
        Полная валидация email адреса

        Args:
            email: Email адрес
            check_mx: Проверять ли MX записи
            check_disposable: Проверять ли одноразовые email

        Returns:
            Полный отчет о валидации
        """
        # Валидация формата
        format_result = self.validate_format(email)

        if not format_result.get('valid'):
            return {
                'success': False,
                'email': email,
                'valid': False,
                'error': format_result.get('error'),
                'checks': {
                    'format': False
                }
            }

        domain = format_result['domain']
        username = format_result['username']

        result = {
            'success': True,
            'email': email,
            'valid': True,
            'username': username,
            'domain': domain,
            'tld': format_result['tld'],
            'checks': {
                'format': True
            }
        }

        # Проверка MX записей
        if check_mx:
            mx_result = await self.check_mx_records(domain)
            result['mx_records'] = mx_result
            result['checks']['mx'] = mx_result.get('has_mx', False)

            # Если нет MX записей, email вероятно невалидный
            if not mx_result.get('has_mx'):
                result['valid'] = False
                result['warnings'] = result.get('warnings', [])
                result['warnings'].append(
                    f"No MX records found: {mx_result.get('error', 'Unknown')}"
                )

        # Проверка одноразового email
        if check_disposable:
            disposable_result = self.check_disposable(domain)
            result['disposable'] = disposable_result
            result['checks']['disposable'] = disposable_result['is_disposable']

            if disposable_result['is_disposable']:
                result['warnings'] = result.get('warnings', [])
                result['warnings'].append('Disposable email domain detected')

        # Информация о провайдере
        provider_info = self.get_provider_info(domain)
        result['provider'] = provider_info

        # Итоговая оценка риска
        risk_score = 0

        if not result['checks'].get('mx', True):
            risk_score += 50  # Нет MX записей - высокий риск

        if result['checks'].get('disposable', False):
            risk_score += 30  # Одноразовый email - средний риск

        if not provider_info['is_popular']:
            risk_score += 10  # Непопулярный провайдер - низкий риск

        if risk_score >= 50:
            result['risk_level'] = 'high'
        elif risk_score >= 30:
            result['risk_level'] = 'medium'
        else:
            result['risk_level'] = 'low'

        result['risk_score'] = risk_score

        return result

    async def validate_bulk(
        self,
        emails: List[str],
        check_mx: bool = True,
        check_disposable: bool = True
    ) -> Dict[str, any]:
        """
        Пакетная валидация множества email адресов

        Args:
            emails: Список email адресов
            check_mx: Проверять ли MX записи
            check_disposable: Проверять ли одноразовые email

        Returns:
            Агрегированные результаты валидации
        """
        tasks = [
            self.validate_email(email, check_mx, check_disposable)
            for email in emails
        ]

        results = await asyncio.gather(*tasks, return_exceptions=True)

        valid_emails = []
        invalid_emails = []
        disposable_emails = []
        high_risk_emails = []

        for result in results:
            if isinstance(result, dict):
                email = result.get('email')

                if result.get('valid'):
                    valid_emails.append(email)
                else:
                    invalid_emails.append({
                        'email': email,
                        'error': result.get('error')
                    })

                if result.get('checks', {}).get('disposable'):
                    disposable_emails.append(email)

                if result.get('risk_level') == 'high':
                    high_risk_emails.append(email)

        return {
            'success': True,
            'total': len(emails),
            'valid': len(valid_emails),
            'invalid': len(invalid_emails),
            'disposable': len(disposable_emails),
            'high_risk': len(high_risk_emails),
            'valid_emails': valid_emails,
            'invalid_emails': invalid_emails,
            'disposable_emails': disposable_emails,
            'high_risk_emails': high_risk_emails,
            'results': [r for r in results if isinstance(r, dict)]
        }
